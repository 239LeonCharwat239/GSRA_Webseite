// GSRA – gemeinsame Helfer der klassischen Skripte (supabase-client.js, ui-dialogs.js, profil-karte.js),
// typisiert für die TypeScript-Module. Fehlt ein Helfer auf einer Seite, gibt es eine einfache Ersatzlösung.

export type DialogOptionen = Record<string, unknown>;

type Fenster = {
  supabaseClient?: unknown;
  supabase?: unknown;
  showToast?: (text: string, art?: string) => void;
  showDialog?: (o: DialogOptionen) => Promise<unknown>;
  openProfileCard?: (id: string, o?: Record<string, string>) => void;
};

export const fenster = window as unknown as Fenster;

// Der Supabase-Client in der Form, die das jeweilige Modul braucht
export const supabaseClient = <T>(): T | undefined => (fenster.supabaseClient || fenster.supabase) as T | undefined;

export const toast = (text: string, art = "info") => fenster.showToast?.(text, art);

export const dialog = (o: DialogOptionen): Promise<unknown> =>
  fenster.showDialog ? fenster.showDialog(o) : Promise.resolve(window.confirm(String(o.title ?? "")));

export const profilZeigen = (id: string) => fenster.openProfileCard?.(id);
