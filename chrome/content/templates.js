var FF_TEMPLATES = {};

FF_TEMPLATES.tooltip =
'\
  <div class="ff-header">${header}</div>\
  <div class="ff-content">${details}</div>\
';

FF_TEMPLATES.details_double_layout =
'\
  <div class="ff-content-top ff-boxFlex1">${top-panel}</div>\
  <div class="ff-content-bottom ff-boxFlex1">${bottom-panel}</div>\
';

FF_TEMPLATES.details_single_layout =
'\
  <div class="${class} ff-boxFlex1">${panel}</div>\
';


FF_TEMPLATES.details_table =
'\
  <table>\
    <tr>\
      <th class="ff-normal ff-day-header" colspan=2>\
        <table width="100%"><tr>\
		<td>\
			<span>${day}</span>\
	        	<span class="ff-normal ff-right ff-links">${links}</span>\
		</td>\
		<td align="right"><span>${date_locale}</span></td>\
	</table></tr>\
	</th>\
    </tr>\
    <tr>\
      <th colspan=2 class="ff-description">\
        <span class="ff-strong">${text-shrt}</span>\
      </th>\
    </tr>\
    <tr>\
      <td rowspan=2 class="ff-image">\
        <img src="${image}"/>\
      </td>\
      <td>\
        <strong class="ff-temperature ${temperature-class}">${temperature-part}</strong>\
      </td>\
    </tr>\
    <tr>\
      <td class="ff-normal">\${realfeel-part}</td>\
    </tr>\
    <tr class="ff-spacer"></tr>\
    ${details}\
  </table>\
';

FF_TEMPLATES.details_row =
'\
  <tr class="ff-normal">\
    <th scope="row" class="ff-details-label">${label}</th>\
    <td class="ff-details-value">${value}</td>\
  </tr>\
';

FF_TEMPLATES.swa_row =
'\
  <div class="ff-swa">${label}</div>\
';

FF_TEMPLATES.image =
  '<img src="${src}"/>';

FF_TEMPLATES.menu =
'\
  <div id="${id}" class="ff-hbox ff-boxFlex1">\
    <img src="${large_image}"/>\
    <span class="ff-small">\
      <strong style="font-size: 110%">${day}</strong> <br />\
      <span class="${cc}">${now} <span class="ff-temperature ${temperature-class}">\
        ${temperature-part}</span> <br /></span>\
      <span class="${forecast}">\
        ${high} <span class="high">${temperature-high}</span> <br />\
        ${low} <span class="low">${temperature-low}</span>\
       </span>\
    </span>\
  </div>\
';

FF_TEMPLATES.radar =
'\
  <table class="ff-radar">\
    <tr>\
      <th class="ff-image ${size}">\
        <a type="radar" href="${link}">\
          <img src="${src}" ${style}/>\
        </a>\
      </th>\
    </tr>\
  </table>\
';

FF_TEMPLATES.text =
'\
  <div class="${class}">${text}</div>\
';

//<tr>\
//<th class="ff-normal links">\
//  <a type="radar-static" href="${radar-links-regional-static}" target="_blank"\
//     rel="localize[features.static]">static</a>\
//  <a type="radar-animated" href="${radar-links-regional-animated}" target="_blank"\
//     rel="localize[features.animated]">animated</a>\
//</th>\
//</tr>\


  //<a type="radar-image" href="${radar-links-regional-animated}" target="_blank"> </a>\

FF_TEMPLATES.link =
  '<a type="${type}" href="${href}" target="_blank">${label}</a>';

FF_TEMPLATES.message =
'\
  <div class="${class}">\
    <a type="${type}" href="${link}" target="_blank">${text}</a>\
  </div>\
';


  //rel="localize[features.swa]">A Severe Weather Alert is active for ${location}.</a>\