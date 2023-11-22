import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let eslintFixTask: vscode.Task | undefined;
let eslintFixTerminal: vscode.Terminal | undefined;


export async function activate(context: vscode.ExtensionContext) {
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

async function runPluginLogic(): Promise<boolean> {
    vscode.commands.registerCommand('auto-inspect-errors.AutoInspectErrors', async () => {
            vscode.window.showInformationMessage('Auto-inspecting errors is about to registing...');
            // 获取当前工作区
            const workspaceFolders  = vscode.workspace.workspaceFolders;

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
                const nonIgnoredFiles = await vscode.workspace.findFiles('**/*.{ts,tsx,vue,js,css}', '**/node_modules/**', 1000);

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
                    checkFixAndCloseFile(file,customErrorRegex);

                    return undefined; // 返回 undefined 表示没有打开的文件
                }));

                // 过滤掉 undefined，以获得实际打开的文件数量
                const actualOpenedFiles = openedFiles.filter(file => file !== undefined);

                vscode.window.showInformationMessage(`Found ${actualOpenedFiles.length} problematic TypeScript file(s).`);
            } catch (error: any) {
                vscode.window.showErrorMessage(`Error reading .gitignore: ${error.message}`);
            }
    });
    return true; // 表示逻辑执行成功
}

const executeEslintFix = async (): Promise<boolean> => {

    let terminal: vscode.Terminal | undefined;

    try {
        // 配置任务
        const task: vscode.Task = new vscode.Task(
            { type: 'shell' },
            vscode.TaskScope.Workspace,
            'eslint-fix',
            'ESLint Fix',
            new vscode.ShellExecution('npm run lint-fix')
        );

        // 执行任务并等待结果
        const execution = await vscode.tasks.executeTask(task);

        // 提前检查任务是否启动成功
        if (!execution || !execution.task) {
            vscode.window.showErrorMessage('Failed to start eslint-fix task. Check your configuration of package.json. like: "lint-fix": "eslint-fix ."');
            return false;
        }

        return new Promise<boolean>((resolve) => {
            // 监听任务结束事件
            const onDidEndTask = vscode.tasks.onDidEndTaskProcess((e) => {
                if (e.execution === execution) {
                    let message = '';
                    let isSuccess = false;

                    // 判断任务状态
                    switch (e.exitCode) {
                        case 0:
                            // 任务成功完成
                            message = 'Auto-fix task completed successfully.';
                            isSuccess = true;
                            break;
                        case 1:
                            // 任务失败
                            message = 'Auto-fix task failed. Check the terminal for details.';
                            isSuccess = true;
                            break;
                        default:
                            // 任务被取消
                            message = 'Auto-fix task was canceled.';
                            break;
                    }

                    // 显示提示消息
                    vscode.window.showInformationMessage(message);

                    // 移除监听
                    onDidEndTask.dispose();

                    // 返回结果
                    resolve(isSuccess);
                }
            });

            // 监听终端关闭事件
            const onDidCloseTerminal = vscode.window.onDidCloseTerminal((closedTerminal) => {
                if (closedTerminal === terminal) {
                    // 用户手动关闭了终端
                    vscode.window.showErrorMessage('Auto-fix task terminated. Please run the plugin again.');

                    // 移除监听
                    onDidCloseTerminal.dispose();

                    resolve(false);
                }
            });

            // 监听用户中断任务（Ctrl+C）的情况
            const onDidTerminateTask = vscode.tasks.onDidEndTaskProcess((terminatedTask) => {
                if (terminatedTask.execution === execution) {
                    // 任务被中断
                    vscode.window.showErrorMessage('Auto-fix task terminated. Please run the plugin again.');

                    // 移除监听
                    onDidTerminateTask.dispose();

                    resolve(false);
                }
            });

        });
    } catch (error: any) {
        console.error(`Error: ${error.message}`);
        return false;
    }
};

const checkFixAndCloseFile = async (file: vscode.Uri,customErrorRegex: RegExp) => {
    const document = await vscode.workspace.openTextDocument(file);

    // 检查自定义错误规则
    const fileContent = document.getText();
    const hasCustomErrors = customErrorRegex.test(fileContent);

    // 获取 vscode 自身的报错
    const hasVSCodeDiagnostics = vscode.languages.getDiagnostics(document.uri).length > 0;

    if (hasVSCodeDiagnostics || hasCustomErrors) {
        await vscode.window.showTextDocument(document, { preview: false });

        // 执行 ESLint 自动修复
        const isExcuteEslintFix = await executeEslintFix();
        /*
            1. 自己ctrl+c取消
            2. 没有配置对应的eslint规则在依赖中
            3. eslint运行中手动删除，也提示用户重新运行命令
        */

        if (isExcuteEslintFix) {
            // 执行之后要去看有没有文件有问题
            if (document && hasVSCodeDiagnostics || hasCustomErrors) {
                return document;
            }
            vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    } else {
        vscode.window.showErrorMessage('ESLint fix failed. Check the terminal for details.');
        return document;
    }
};

async function getEslintFixTask(): Promise<vscode.Task | undefined> {
    const eslintFixTaskName = 'eslint-fix';

    // 获取所有任务
    const tasks = await vscode.tasks.fetchTasks();

    // 查找 eslint-fix 任务
    const eslintFixTask = tasks.find(task => task.name === eslintFixTaskName);

    return eslintFixTask;
}

export function deactivate() { }

