import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { checkFixAndCloseFile } from './checkFixAndCloseFile';
import { getEslintFixTask } from './getEslintFixTask';
import { getCurrentFileLineContent } from './getCurrentFileLineContent';

let eslintFixTask: vscode.Task | undefined;
let eslintFixTerminal: vscode.Terminal | undefined;
let lineCount: number = 0;


/**
 * Activates the extension and performs necessary setup tasks such as initializing tasks, running plugin logic, and handling errors.
 *
 * @param {vscode.ExtensionContext} context - The context of the extension being activated.
 * @return {Promise<void>} A promise that resolves when the activation process is complete.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        vscode.window.showInformationMessage('Auto-inspecting errors is about to start...');
        // 在插件激活时检查任务状态
        eslintFixTask = await getEslintFixTask();

        if (eslintFixTask) {
            // 任务存在，重新创建终端
            eslintFixTerminal = vscode.window.createTerminal({ name: 'eslint-fix', shellPath: 'npm', shellArgs: ['run', 'lint-fix'] });
            eslintFixTerminal.show();
        }

        const result = await runPluginLogic();

        if (!result) {
            // 降级处理或者其他处理方式
            console.warn('插件逻辑执行失败，插件将以降级模式继续运行。');
        }
    } catch (error) {
        vscode.window.showErrorMessage('插件遇到了一个错误，请查看控制台获取更多信息。');
        // 记录错误到插件日志
        console.error('An error occurred in the extension:', error);
    }
}

/**
 * Runs the plugin logic to auto-inspect errors in the workspace.
 *
 * @return {Promise<boolean>} Indicates if the logic execution was successful.
 */
async function runPluginLogic(): Promise<boolean> {
    vscode.commands.registerCommand('auto-inspect-errors.AutoInspectErrors', async () => {
        vscode.window.showInformationMessage('Auto-inspecting errors is about to registing...');
        console.log('AutoInspectPlugin :>> ', 'the plugin is started');
        // 获取当前工作区
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace folder opened.');
            return;
        }
        const workspaceFolder = workspaceFolders[0].uri.fsPath;

        // 获取用户配置
        const config = vscode.workspace.getConfiguration('autoInspectErrors');
        const excludedPatterns: string[] = config.get('excludedPatterns', []);
        const customErrorRules: string[] = config.get('customErrorRules', []);

        // 构建.gitignore文件路径
        const gitIgnorePath = path.join(workspaceFolder, '.gitignore');

        try {
            const gitIgnoreContent = await fs.promises.readFile(gitIgnorePath, 'utf-8');

            const ignoreRules = gitIgnoreContent
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !line.startsWith('#'))
                .map(line => new vscode.RelativePattern(workspaceFolder, line));

            // 添加用户配置的排除规则
            excludedPatterns.forEach(pattern => {
                ignoreRules.push(new vscode.RelativePattern(workspaceFolder, pattern));
            });

            // 添加用户配置的自定义错误规则
            const customErrorRegex = new RegExp(customErrorRules.join('|'));


            // 添加新的排除规则，排除 node_modules 目录
            ignoreRules.push(new vscode.RelativePattern(workspaceFolder, 'node_modules/**'));

            // 使用异步 vscode.workspace.findFiles 替代同步 vscode.workspace.findFiles
            const nonIgnoredFiles = await vscode.workspace.findFiles('**/*.{ts,tsx,vue,js,json,css}', '**/node_modules/**', 1000);

            const matchingFiles = nonIgnoredFiles.filter(file => {
                const filePath = path.relative(workspaceFolder, file.fsPath);

                return ignoreRules.every(rule => {
                    const relativePath = path.relative(workspaceFolder, rule.base);
                    const rulePath = path.join(relativePath, rule.pattern);

                    return !filePath.startsWith(rulePath);
                });
            });

            // 使用 Promise.all 并行处理异步操作
            const openedFiles = await Promise.all(matchingFiles.map(async file => {
                const res = await checkFixAndCloseFile(file, customErrorRegex);
                if (res) return res
                return undefined; // 返回 undefined 表示没有打开的文件
            }));

            // 过滤掉 undefined，以获得实际打开的文件数量
            const actualOpenedFiles = openedFiles.filter(file => file !== undefined);

            // 获取当前组件的行数
            vscode.window.onDidChangeActiveTextEditor(async (editor) => {
                if (editor) {
                    const res = await getCurrentFileLineContent()
                    if (res > 500) {
                        await splitFiles(editor.document)
                    }
                }
            })

            //
            vscode.workspace.onDidChangeTextDocument(async (event) => {
                if (event) {
                    const res = await getCurrentFileLineContent()
                    if (res > 500) {
                        await splitFiles(event.document)
                    }
                }
            })

            vscode.window.showInformationMessage(`Found ${actualOpenedFiles.length} problematic TypeScript file(s).`);
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error reading .gitignore: ${error.message}`);
        }
    });
    return true; // 表示逻辑执行成功
}
/**
 * Splits the given document into files.
 *
 * @param {vscode.TextDocument} document - the document to be split
 * @return {Promise<void>} a Promise that resolves when the file is split
 */
const splitFiles = async (document: vscode.TextDocument) => {
    console.log('File is being split...');
}
export function deactivate() { }

