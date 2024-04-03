import * as vscode from 'vscode';
import { executeEslintFix } from './executeEslintFix';

/**
 * Check, fix, and close a file based on custom error rules and ESLint fixes.
 *
 * @param {vscode.Uri} file - The URI of the file to check and fix.
 * @param {RegExp} customErrorRegex - The custom error regex to check for in the file content.
 * @return {Promise<vscode.TextDocument>} The modified text document after checks and fixes.
 */
export const checkFixAndCloseFile = async (file: vscode.Uri, customErrorRegex: RegExp): Promise<any> => {
  try {
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
        if (document && (hasVSCodeDiagnostics || hasCustomErrors)) {
          await vscode.window.showTextDocument(document, { preview: false });
        } else {
          vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        }
      }
      return document;
    } else {
      vscode.window.showInformationMessage('eslint fix script is aready done, please modifed details manually');
      return document;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    vscode.window.showErrorMessage('ESLint fix failed. Check the terminal for details.');
  }

};
