import * as vscode from 'vscode';

/**
 * Retrieves the eslint-fix task from the list of tasks.
 *
 * @return {Promise<vscode.Task | undefined>} The eslint-fix task if found, otherwise undefined.
 */
export async function getEslintFixTask(): Promise<vscode.Task | undefined> {
  const eslintFixTaskName = 'eslint-fix';

  // 获取所有任务
  const tasks = await vscode.tasks.fetchTasks();

  // 查找 eslint-fix 任务
  const eslintFixTask = tasks.find(task => task.name === eslintFixTaskName);

  return eslintFixTask;
}
