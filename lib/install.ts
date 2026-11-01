export const INSTALL_PATH = "/install";

export function installUrl(origin: string) {
  return `${origin}${INSTALL_PATH}`;
}

export function installWhatsAppText(origin: string) {
  return `התקינו את אפליקציית בית רימון למסך הבית:\n${installUrl(origin)}`;
}

export function installWhatsAppHref(origin: string) {
  return `https://wa.me/?text=${encodeURIComponent(installWhatsAppText(origin))}`;
}
