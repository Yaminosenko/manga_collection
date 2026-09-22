import { CHEMIN_SERVICE_WORKER, CLE_GLOBALE_INSTALLATION } from "@/lib/constants";

export const SCRIPT_INSTALLATION = [
  "(function(){",
  `window.${CLE_GLOBALE_INSTALLATION}=null;`,
  'addEventListener("beforeinstallprompt",function(evenement){',
  `evenement.preventDefault();window.${CLE_GLOBALE_INSTALLATION}=evenement});`,
  `addEventListener("appinstalled",function(){window.${CLE_GLOBALE_INSTALLATION}=null});`,
  'if("serviceWorker" in navigator){addEventListener("load",function(){',
  `navigator.serviceWorker.register("${CHEMIN_SERVICE_WORKER}").catch(function(){})})}`,
  "})();",
].join("");
