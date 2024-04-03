import * as vscode from 'vscode';

/**
 * Gets the number of lines in the active file.
 * @returns {Promise<number>} The number of lines in the file.
 */
export async function getCurrentFileLineContent(): Promise<number> {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return 0;
  }

  const { document } = activeEditor;
  if (!document || !(document.fileName.endsWith('.vue') || document.fileName.endsWith('.tsx'))) {
    return 0;
  }

  const text = document.getText();
  return text.split(/\r\n|\r|\n/).length;
}
