var forecastfox_s3 = {};

/**
 * @author Oleksandr
 */

 
//------------------------------------------------------------------------------
forecastfox_s3.addon = {
	version : '0',
	donateURL: 'https://addons.mozilla.org/addon/screengrab-fix-version/contribute/installed/',
	prefService: Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService)
};

//------------------------------------------------------------------------------
forecastfox_s3.addon.get_version = function() {
	Components.utils.import("resource://gre/modules/AddonManager.jsm");
	AddonManager.getAddonByID('forecastfox@s3_fix_version', function(addon) {
		forecastfox_s3.addon.version = addon.version;
		if ((addon.version != '') && (addon.version != '0')) {
			setTimeout(forecastfox_s3.addon.checkPrefs, 2000);
		}
	});
}
//------------------------------------------------------------------------------
forecastfox_s3.addon.addonDonate = function() {
	try{
//		gBrowser.selectedTab = gBrowser.addTab(forecastfox_s3.addon.donateURL);
	}catch(e){;}
}
//------------------------------------------------------------------------------
forecastfox_s3.addon.checkPrefs = function() {
	var mozilla_prefs = forecastfox_s3.addon.prefService.getBranch("extensions.forecastfox_s3.");

	//----------------------------------------------------------------------
	var old_version = mozilla_prefs.getCharPref("current_version", '0');
	var not_open_contribute_page = mozilla_prefs.getBoolPref("not_open_contribute_page");

	//----------------------------------------------------------------------
	if (forecastfox_s3.addon.version != old_version) {
		mozilla_prefs.setCharPref("current_version", forecastfox_s3.addon.version);
		var result = ((old_version == '') || (old_version == '0')) ? false : true;
		//--------------------------------------------------------------
		if (result) {
			if (! not_open_contribute_page) {
				forecastfox_s3.addon.addonDonate();
			}
		}
	}
}


window.addEventListener("load", forecastfox_s3.addon.get_version, false);
