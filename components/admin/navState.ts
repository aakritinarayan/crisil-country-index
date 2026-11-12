/* Sidebar collapsed state: <html data-admin-nav="collapsed">, remembered per browser.
 * NAV_SCRIPT runs before paint (console layout) so the rail never jumps on load. */
export const NAV_KEY = "admin-nav";
export const NAV_SCRIPT = `try{if(localStorage.getItem('${NAV_KEY}')==='collapsed')document.documentElement.dataset.adminNav='collapsed'}catch(e){}`;
