var exports = module.exports = (client) => {
	return new Twitter(client);
}	

class Twitter {

	constructor(client) {
		this.client = client;
	}

	getUserInfo(screen_name) {
		return new Promise((resolve, reject) => {
			this.client.get('users/show', { "screen_name":screen_name})
    		.then( data => {
    			let result = {};
    			result.profile_background_color           = data.profile_background_color;
				result.profile_background_image_url       = data.profile_background_image_url;
				result.profile_background_image_url_https = data.profile_background_image_url_https;
				result.profile_image_url                  = data.profile_image_url;
				result.profile_image_url_https            = data.profile_image_url_https;
				result.profile_link_color                 = data.profile_link_color;
				result.profile_sidebar_border_color       = data.profile_sidebar_border_color;
				result.profile_sidebar_fill_color         = data.profile_sidebar_fill_color;
				result.profile_sidebar_border_color       = data.profile_sidebar_border_color;
				result.profile_text_color                 = data.profile_text_color;
    			resolve(result);
    		})
    		.catch( err => reject(err));	
		})
	}
}