import * as path from "path";
import { QuickPickItem, Uri, window } from "vscode";
import { Repository } from "./repository";

export class IgnoreSingleItem implements QuickPickItem {
  constructor(
    public expression: string,
    public recursive: boolean = false
  ) {}

  get label(): string {
    const text = this.recursive ? " (Recursive)" : "";
    return `${this.expression}${text}`;
  }

  get description(): string {
    const text = this.recursive ? " (Recursive)" : "";
    return `Add '${this.expression}' to 'svn:ignore'${text}`;
  }
}

export async function inputIgnoreList(repository: Repository, uris: Uri[]) {
  if (uris.length === 0) {
    return false;
  }

  const regexExtension = new RegExp("\\.[^\\.]+(\\.map)?$", "i");

  if (uris.length === 1) {
    const uri = uris[0];
    const matchExt = uri.fsPath.match(regexExtension);
    const ext = matchExt && matchExt[0] ? matchExt[0] : "";
    const fileName = path.basename(uri.fsPath);
    const dirName = path.dirname(uri.fsPath);

    const picks: IgnoreSingleItem[] = [];
    picks.push(new IgnoreSingleItem(fileName));
    if (ext) {
      picks.push(new IgnoreSingleItem("*" + ext));
    }
    picks.push(new IgnoreSingleItem(fileName, true));
    if (ext) {
      picks.push(new IgnoreSingleItem("*" + ext, true));
    }

    const pick = await window.showQuickPick(picks);

    if (!pick) {
      return false;
    }

    return repository.addToIgnore([pick.expression], dirName, pick.recursive);
  }

  const count = uris.length;
  const recursive = "(Recursive)";

  const ignoreByFileName = `Ignore ${count} by filename`;
  const ignoreByExtension = `Ignore ${count} by extension`;
  const ignoreByFileNameRecursive = `Ignore ${count} by filename ${recursive}`;
  const ignoreByExtensionRecursive = `Ignore ${count} by extension ${recursive}`;

  const picks: string[] = [
    ignoreByFileName,
    ignoreByExtension,
    ignoreByFileNameRecursive,
    ignoreByExtensionRecursive
  ];

  const pick = await window.showQuickPick(picks);

  if (!pick) {
    return false;
  }

  const isByFile = pick.startsWith(ignoreByFileName);
  const isRecursive = pick.endsWith(recursive);

  const byDir: { [key: string]: string[] } = {};

  for (const uri of uris) {
    const dirname = path.dirname(uri.fsPath);
    const filename = path.basename(uri.fsPath);
    const matchExt = uri.fsPath.match(regexExtension);
    const ext = matchExt && matchExt[0] ? matchExt[0] : "";

    if (typeof byDir[dirname] === "undefined") {
      byDir[dirname] = [];
    }

    if (isByFile) {
      byDir[dirname].push(filename);
    } else if (ext) {
      byDir[dirname].push("*" + ext);
    }
  }

  for (const dir in byDir) {
    if (byDir.hasOwnProperty(dir)) {
      const files = [...new Set(byDir[dir])]; // Unique list
      await repository.addToIgnore(files, dir, isRecursive);
    }
  }

  return true;
}
