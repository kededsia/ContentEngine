import { SavedScript } from "./kenshi-data";

const STORAGE_KEY = "kenshi-saved-scripts";

export function getSavedScripts(): SavedScript[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveScript(script: SavedScript): void {
  const scripts = getSavedScripts();
  scripts.unshift(script);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}

export function deleteScript(id: string): void {
  const scripts = getSavedScripts().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
}
