import * as vscode from 'vscode';

/**
 * Executes an ESLint fix task in the workspace and returns a boolean indicating success.
 *
 * @return {Promise<boolean>} Promise that resolves to a boolean indicating if the ESLint fix task was successful.
 */

export const executeEslintFix = async (): Promise<boolean> => {

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
