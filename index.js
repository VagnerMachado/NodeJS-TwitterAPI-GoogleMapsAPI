/*
=-=-=-=-=-=-=-=-=-=-=-=-
Comment (Required): Twitter and Google Maps API Mash Up.

Broadly speaking, the user fills the form served by accessing the root of the server. Upon submitting it, the user
data is parsed and verified. That data is used to request data from a first API. Data received from that API is parsed
and used to request data from a second API. Both sets of data are intertwined and a response is served to the user.

That is a general idea of what the program accomplishes. However, in and between those steps are a myriad of tasks
that happen in order to enforce proper functionality. Aiming to detail the program flow more in depth, I decided to
add the algorithm below to provide more information to interested parties.

** Server Structure **

	Folders:
		auth - stores the access token and expiration in file authorization-res.json
		credentials - stores the key and secret used to acquire an access token
		html - stores an HTML file describing a form that the user can fill out and send information to the server
		images - stores favicon, 404.jpg and map placeholder case a place does not have a map
		mapCache - stores static map images to be used as cache for future users
		twitterCache - stores query sent to and data received from Twitter as response
		index.js - the file with the instructions to instantiate the server for this assignment

** Server Algorithm **

1. Instantiate a server that listens to port 3000 and is able to attend to requests
2. Case there is a request:
	1. Case accessing the root, serve the form in folder html.
	2. Case requesting a favicon, serve the favicon in folder images.
	3. Case the the request url starts with /mapCache/
		1. Open a read stream set to the request url
		2. When ready, serve map at request url
		3. Case stream has an error
			1. Open a read stream to images/noMap.jpg
			2. When ready, serve that placeholder image
			3. Case the stream has an error, close response.
	4. Case requesting /images/404.jpg
		1. Open read stream at that location
		2. Pipe that image to response.
	5. Case the request stats with twitterQuery
		1. Parse and validate request URL
		2. Case data is undefined of blank, serve 404 error page.
		3. Check cache for term entered in the form.
			1. If it exists and not expired
				2. Use cached data and proceed to verify map cache
				3. For each map needed but not in cache
					1. Create a call to Google maps requesting a map
					2. Save map to cache.
				4. Proceed to serve twitter data and maps to the user
					1. Add HTML tags, CSS attributed, data from twitter and image tags to map resources.
					2. Send data, end connection.
			2. Case the term searched is not in cache or expired
			1. Check if the access token to Twitter API is expired.
				1. Case it is expired, perform a request for a new access token to Twitter Api.
				2. Parse response, set expiration date.
				3. Cache token and expiration date
			2. Use access token to request data from the Twitter API based on data sent by the user.
			3. Parse, set expiration date and cache the data received fro Twitter.
			4. Proceed to verify map cache
				1. For each map needed but not in cache
					1. Create a call to Google maps requesting a map
					2. Save map to cache.
				2. Proceed to serve twitter data and maps to the user
					1. Add HTML tags, CSS attributed, data from twitter and image tags to map resources.
					2. Send data, end connection.
	6. Catch all, for any unauthorized access or invalid directory access attempt.
		1. Severs and html form response with 404 error.

** NOTE **

	Unauthorized access to directories or by injecting information to url should not cause error or break the server.

=-=-=-=-=-=-=-=-=-=-=-=-
Student ID: 23651127
Vagner Machado - Spring 2020 - Queens College
*/
const fs = require('fs');

//requires modules to creates servers, perform requests
const http = require('http');
const https = require('https');
const url = require('url');

//create an http server
const server = http.createServer();
const port = 3000;

//server emitters for listening, error and request
server.on("listening", listening_handler);
server.on("error", (err) => { console.log("\n**SERVER ERROR**\n", err.message) });
server.on("request", connection_handler);

//Initialize the server listening to port 3000
server.listen(port);

/**
 * listening_handler: prints the listening port
 */

function listening_handler() {
	console.log(`Now Listening on Port ${port}`);
}

/**
 * connection_handler:  handles connection to server
 * responses to the user:
 *      # root: servers a form to be filled by user.
 *      # images: servers map noMap.jpg, 404.jpg, favicon.ico
 * 		# mapCache/ : serves the map at req.url, case not existing,  noMap.jpg
 *      # queryTwitter/ parsed, validates, call twitter and google APIs
 *      # all others: serves an error page
 * @param {the request sent by user of API} req
 * @param {the response to the user of API } res
 */
function connection_handler(req, res) {
	console.log(`New Request for ${req.url} from ${req.socket.remoteAddress}`);

	//request for the homepage: respond with homepage html file	with form
	if (req.url === "/") {
		const form = fs.createReadStream('html/form.html');
		res.writeHead(200, { 'Content-Type': 'text/html' });
		form.pipe(res);
	}

	//request for the favicon for the page: respond with favicon for the page
	else if (req.url === "/images/favicon.ico") {

		const icon = fs.createReadStream("images/favicon.ico");
		res.writeHead(200, { "Content-Type": "image/x-icon" });
		icon.pipe(res);
	}

	//request for map cache
	else if (req.url.startsWith("/mapCache/")) {
		let map_stream = fs.createReadStream((`.${req.url}`));

		//event for stream error
		map_stream.on("error", function (err) {
			let noMap_stream = fs.createReadStream("./images/noMap.png");

			//WILL DISPLAY PLACEHOLDER MAP, LINK TO ACTUAL MAP WORKS ON SERVED RESPONSE
			noMap_stream.on("error", function (err) {
				//IF THE BACKUP FOR THE ERROR FAILS THEN JUST FINISH CONNECTION.
				res.end();
			});
			//EVENT TO PIPE PLACEHOLDER MAP
			noMap_stream.on("ready", function () {
				res.writeHead(200, { "Content-Type": "image/png" });
				noMap_stream.pipe(res);
			});

		});

		//EVENT TO TRIGER PIPING OF MAP
		map_stream.on("ready", function () {
			res.writeHead(200, { "Content-Type": "image/jpeg" });
			map_stream.pipe(res);
		});
	}

	/*
	*PARSES AND VALIDATES DATA SENT BY USER. CHECK CACHE FOR TWITTER DATA AND GOOGLE MAP DATA,
	* REQUEST DATA EXPIRED OR NOT IN CACHE, SET EXPIRATION DATE, CACHE NEW DATA, SERVE DATA TO USER
	*/
	else if (req.url.startsWith("/queryTwitter")) {
		//USER INPUT
		let userInputObject = url.parse(req.url, true).query;
		let languages = ["en", "ja", "pt", "es", "de", "fr", "all"];
		let types = ["keyword", "quote", "hashtag", "username"];

		//FILTER URL HACKS, MISSING INPUT OF WRONG QUERY
		if (userInputObject.textInput === undefined ||
			userInputObject.type === undefined ||
			userInputObject.lang === undefined ||
			userInputObject.textInput === "" ||
			userInputObject.type === "" ||
			userInputObject.lang === "" ||
			languages.indexOf(String(userInputObject.lang)) < 0 ||
			types.indexOf(String(userInputObject.type)) < 0) {
			console.log("Illegal data sent through URL");
			res.writeHead(404, { "Content-Type": "text/html" });
			res.end("<h1 style='text-align: center; padding: 10px; font-size:200%;'>INVALID QUERY </br></br>Please use the form on the Homepage </h1>" +
				"<img style='display: block; border: 5px solid black; margin-left: auto; " +
				"margin-right: auto; ' height= 400 width=600 src=images/404.jpg />" +
				"<a href='http://localhost:3000'><p style='text-align:center;font-size:200%;'>HOMEPAGE</p></a>");
			return; //FOUND THAT RETURN IS BETTER THAN THE EVER INCREASING NUMBER OF ELSES.
		}

		console.log("User searched for:\n\t\t\t term: ", userInputObject.textInput.trim()
			.toLowerCase().concat("\n\t\t\t type: ")
			.concat(userInputObject.type)
			.concat("\n\t\t\t language: ").concat(userInputObject.lang).concat("\n"));

		//FORMAT DATA TO CHECK FOR CACHED SEARCH
		let term = userInputObject.textInput.trim().toLowerCase().concat("-").concat(userInputObject.type).concat("-").concat(userInputObject.lang);
		term = term.replace(/[\\\/\^:\*?"<>|]/g, "%");
		console.log("Checking cached term: ", term);
		let data_cache = false;

		//CHECK IF DATA EXISTS IN CACHE
		if (fs.existsSync("./twitterCache/".concat(term).concat(".json"))) {
			let search_cache = require("./twitterCache/".concat(term).concat(".json"));

			//CHECK IF DATA IS EXPIRED, I SET A RIDICULOUS HIGH EXPIRATION SO I WOULD NOT RUN OUT OF API CALLS DURING DEVELOPMENT
			let cached_Time = new Date(search_cache.results[0].created_at);
			cached_Time.setMinutes(cached_Time.getMinutes() + 15); //TEST FOR CACHE: SET HIGH EXPIRATION TO REDUCE API CALLS setFullYear(cached_Time.getFullYear() + 1);
			let now = Date.now();
			console.log("Cached Search Time Expiration:", Number(cached_Time));
			console.log("Current Time for Comparisons :", Number(now));

			//CASE THE CACHED DATA IS VALID
			if (now > cached_Time) {

				data_cache = true;
				console.log("Cached search valid, serving cached Twitter data");
				verify_cached_maps(search_cache.results, res);
			}
			else //ELSE IT DOES NOT EXIST OR IS EXPIRED
				console.log("Cached search data expired, performing new search on Twitter")
		}

		if (data_cache == false) {
			console.log("Checking Twitter access token cache");

			//CHECK FOR CACHED CREDENTIAL
			let token_cache_valid = false;
			let cached_auth;

			//case file with authentication exists
			if (fs.existsSync('./auth/authentication-res.json')) {
				cached_auth = require('./auth/authentication-res.json');

				//case expired token
				if (Date.now() > cached_auth.expiration)
					console.log("Cached Token Expired");

				//case valid token
				else {
					token_cache_valid = true;
					console.log("Cached Token Valid");
				}
			}

			//IF CACHED TOKEN IS VALID, CREATE A SEARCH WITH CACHED TOKEN
			if (token_cache_valid) {
				create_search_req(cached_auth.access_token, userInputObject, res, term);
				console.log("Creating a new search with old Twitter access token");
			}

			//POST A NEW REQUEST FOR A TOKEN
			else {
				//BASE 64 KEYS
				let cred = require('./credentials/client_id');
				let api_key = cred.twitter_api_key;
				let api_key_secret = cred.twitter_api_key_secret;
				let base64data = Buffer.from(`${api_key}:${api_key_secret}`).toString('base64');
				let base = `Basic ${base64data}`;

				//POST FOR TOKEN
				let post_data = { "grant_type": "client_credentials" };
				let headers = { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", "Authorization": base }
				const querystring = require('querystring');
				post_data = querystring.stringify(post_data);
				let options = { "method": "POST", "headers": headers };

				//SEND TOKEN REQUEST TO ENDPOINT
				const token_endpoint = "https://api.twitter.com/oauth2/token";
				let auth_sent_time = new Date();
				console.log("Performing HTTPS POST request for new Token from Twitter API");
				let authentication_req = https.request(token_endpoint, options, function (authentication_res) {

					//HANDLE RECEIVED DATA
					received_authentication(authentication_res, auth_sent_time, userInputObject, res, term);
				});
				//LISTEN FOR AUTHENTICATION ERRORS, 404 IF SO
				authentication_req.on("error", function (err) {
					console.error("Error while requesting a new Token from Twitter");
					res.writeHead(404, { "Content-Type": "text/html" });
					res.end("<h1 style='text-align: center; padding: 10px; font-size:200%;'>FAILED TO AUTHENTICATE WITH TWITTER</br>PLEASE TRY AGAIN! </h1>" +
						"<img style='display: block; border: 5px solid black; margin-left: auto; " +
						"margin-right: auto; ' height= 400 width=600 src=images/404.jpg />" +
						"<a href='http://localhost:3000'><p style='text-align:center;font-size:200%;'>HOMEPAGE</p></a>");

				});
				//POST DATA
				authentication_req.end(post_data);
			}
		}
	}
	//serves the image resource for tag in error page
	else if (req.url.endsWith("/images/404.jpg")) {

		const fail = fs.createReadStream("images/404.jpg");
		res.writeHead(200, { "Content-Type": "image/jpeg" });
		fail.pipe(res);
	}

	//catch all: serves error html and .jpg resource path to invalid directories
	else {
		res.writeHead(404, { "Content-Type": "text/html" });
		res.end("<h1 style='text-align: center; padding: 10px; font-size:200%;'>INVALID DIRECTORY </h1>" +
			"<img style='display: block; border: 5px solid black; margin-left: auto; " +
			"margin-right: auto; ' height= 400 width=600 src=images/404.jpg />" +
			"<a href='http://localhost:3000'><p style='text-align:center;font-size:200%;'>HOMEPAGE</p></a>");
	}
}

//PARSES THE RECEIVED AUTHENTICATION FROM THE TWITTER API
const received_authentication = function (authentication_res, auth_sent_time, userInputObject, res, term) {
	authentication_res.setEncoding("utf8");
	let body = "";
	//append data from Twitter API
	authentication_res.on("data", function (chunk) { body += chunk; });

	//PARSE AUTHENTICATON DATA
	authentication_res.on("end", function () {

		//SET EXPIRATION DATE
		let twitter_auth = JSON.parse(body);
		let before = auth_sent_time.getTime();
		twitter_auth.expiration = auth_sent_time.setHours(auth_sent_time.getHours() + 1);
		let after = auth_sent_time.getTime();

		//CACHE THE ACCESS TOKEN
		create_acess_token_cache(twitter_auth);
		console.log("Creating search after new Token issued");

		//PROCEED TO PERFORM A TWITTER API SEARCH
		create_search_req(twitter_auth.access_token, userInputObject, res, term);
	});
};

//SEARCHES TWITTER FOR DATA BASED ON USER INPUT AND USING THE ACCESS TOKEN
const create_search_req = function (twitter_auth, userInputObject, res, term) {

	//FORMAT JSON TO SEND TO TWITTER
	let query_data = "{\"query\":\"";
	let nospace = userInputObject.textInput.replace(/ /g, "");

	//USER CAN SEARCH FOR KEYWORDS, USERNAMES, HASHTAGS, QUOTE
	if (userInputObject.type == "keyword") {
		query_data += nospace + " ";
	}
	else if (userInputObject.type == "username") {
		query_data += "@" + nospace + " ";
	}
	else if (userInputObject.type == "hashtag") {
		query_data += "#" + nospace + " ";
	}
	else //ELSE IS A QUOTE
		query_data += "\\\"" + userInputObject.textInput + "\\\"";

	//CASE NOT ALL LANGUAGES, ADD THAT LANGUAGES. LANGUAGE IS ALREADY VALIDATED AT BEGINNING OF REQ.URL FOR /queryTwitter.
	if (userInputObject.lang !== "all")
		query_data += "lang: " + userInputObject.lang;

	//MY API MASH UP REQUIRES GEO SO I CAN SERVE MAPS
	query_data += " has:geo\"}";
	console.log("Query Sent to Twitter", query_data);

	//SET HEADERS AND OPTIONS
	let headers = { "Content-Type": "application/json", "tweet_mode": "extended", "authorization": "Bearer " + twitter_auth }
	let options = { "method": "POST", "headers": headers };

	//SEND REQUEST TO ENDPOINT
	const token_endpoint = "https://api.twitter.com/1.1/tweets/search/30day/VM355.json";

	console.log("Performing HTTPS POST request for data query from Twitter API");
	let data_req = https.request(token_endpoint, options, function (query_res) {
		parseQueryResponse(query_res, res, term);
		console.log("Received query response from Twitter");
	});

	//LISTEN FOR ERRORS
	data_req.on("error", function (err) {
		console.error("Error while requesting data from Twitter");
		res.writeHead(404, { "Content-Type": "text/html" });
		res.end("<h1 style='text-align: center; padding: 10px; font-size:200%;'>WE COULD NOT REACH TWITTER </br>PLEASE TRY AGAIN! </h1>" +
			"<img style='display: block; border: 5px solid black; margin-left: auto; " +
			"margin-right: auto; ' height= 400 width=600 src=images/404.jpg />" +
			"<a href='http://localhost:3000'><p style='text-align:center;font-size:200%;'>HOMEPAGE</p></a>");
	});
	data_req.end((query_data));

}

//CACHES THE TOKEN RECEIVED FROM THE TWITTER API
const create_acess_token_cache = function (twitter_auth) {
	fs.writeFile('./auth/authentication-res.json', JSON.stringify(twitter_auth), function (err) {
		if (err)
			console.log("Error Writing Twitter API Token to Cache");
		else
			console.log("New Twitter API Token Written to Cache Successfully");
	});
};

//PARSES THE DATA RECEIVED FROM TWITTER AS RESULT OF A API REQUEST
const parseQueryResponse = function (query_res, res, term) {
	console.log("Parsing Twitter query response");
	query_res.setEncoding("utf8");
	let body = "";

	//append data from TWITTER API
	query_res.on("data", function (chunk) { body += chunk; });

	//when data is done, parse and process it
	query_res.on("end", function () {
		//set expiration date
		let twitter_data = JSON.parse(body);
		let arr = [];

		// IF NO DATA, CAUSES A NO RESULT RESPONSE, NO CACHING
		if (twitter_data == undefined || twitter_data.results == undefined) {
			console.log("Twitter API returned undefined data, not written to cache.");
			verify_cached_maps([], res);
		}

		//IF NO DATA, CAUSES A NO RESULT RESPONSE
		else if (twitter_data.results.length == 0) {
			console.log("Twitter API returned zero results for term, nothing to write to cache.");
			verify_cached_maps([], res);
		}
		else
		{
			//CACHE THE DATA RECEIVED FROM TWITTER
			cache_Twitter_Search(twitter_data, res, term);

			//VERIFY CACHED MAPS
			console.log("Verifying cached maps for new Twitter data");
			verify_cached_maps(twitter_data.results, res);
		}	
	});
}

// CACHES THE RESULT RECEIVED FROM TWITTER API CALL
let cache_Twitter_Search = function (twitter_data, res, term) {

	//WRITE THE DATA TO CACHE, PROCEED TO VERIFY CACHED MAPS
	
		fs.writeFile("./twitterCache/".concat(term).concat(".json"), JSON.stringify(twitter_data), function (err) {
			if (err) 
			{
				console.log("Error writing Twitter search data to cache");
			}
			else 
			{
				console.log("Twitter query results written to cache");
			}
		});
};

//VERIFIES WHAT MAPS ARE NOT IN CACHE, REQUESTS AND CACHES THEM
let verify_cached_maps = function (arr, res) {
	//SETUP ARRAY FOR LOCATIONS IN QUESTION
	let all_locations = [];
	let needed_maps = []; //WAS GOING TO USE A SET TO AVOID REPEATS BUT DECIDED TO CHECK BEFORE ADDING TO ARRAY

	//GET A LIST OF ALL LOCATIONS IN TWEETS
	let item = 0;

	//GET LOCATION NAMES
	for (item in arr) {
		let map = (arr[item].place.full_name);
		map = map.replace(/[ ]/g, ""); //replace the spaces in the name
		all_locations.push(map);
		if (fs.existsSync("./mapCache/".concat(encodeURI(map)).concat(".jpg"))) {
			// I got some errors by negating as !fs.existsSync(...)
		}
		else 
		{
			if (needed_maps.indexOf(map) < 0)
				needed_maps.push(map);
		}
	}

	//CASE ALL IMAGES ARE CACHED, JUST SERVE PAGE
	let to_download = needed_maps.length;
	if (to_download == 0) {
		serve_page(arr, all_locations, res);
		console.log("All maps in cache.")
	}

	//OTHERWISE GET THE NEEDED MAPS
	else {
		//SETUP NECESSARY CALLS TO GOOGLE MAP API
		let base_address = "http://maps.googleapis.com/maps/api/staticmap?center=";
		let map_type = "&zoom=10&size=600x300&maptype=roadmap"
		let marker = "&markers=color%3Ablue%7Clabel%3AVM%7C";
		let api_key = require('./credentials/client_id').google_api_key; //LEARNED THIS SHORTCUT!

		//CALLBACK COUNTERS
		let current = 0;

		//REQUEST THE MAPS NOT IN CACHE TO GOOGLE API
		console.log("Downloading maps not in cache");
		for (let k = 0; k < to_download; k++) {

			//GET URI FORMATTED
			let thisMap = base_address.concat(needed_maps[k]).concat(map_type).concat(marker).concat(needed_maps[k]).concat("&key=").concat(api_key);

			//PERFORM THE REQUEST
			let image_req = http.get(thisMap, function (image_res) {
				console.log("Performing HTTPS GET request for Google Map for", needed_maps[k]);

				//WRITE RECEIVED MAP TO CACHE
				let new_img = fs.createWriteStream("./mapCache/" + encodeURI(needed_maps[k]) + ".jpg", { "encoding": null });
				image_res.pipe(new_img);

				//INCREMENT COUNTER AND SERVE PAGE IF ALL MAPS WERE DOWNLOADED
				new_img.on("finish", function () {
					current++;
					console.log("Finished Download for Google Map for", needed_maps[k])

					//SERVE PAGE IF ALL MAPS WERE DOWNLOADED
					if (current == to_download) {
						console.log("All maps downloaded, serving page")
						serve_page(arr, all_locations, res);
					}
				});
				new_img.on("error", function (err) { console.log("Error writing the Map to cache"); });
			});
			image_req.on("error", function (err) { console.log("Error Requesting to Downloading Map") });
		}
	}
}

//USE DATA FROM TWITTER AND GOOGLE MAPS API TO CONSTRUCT AND SERVE A NICELY FORMATTED RESPONSE PAGE.
let serve_page = function (arr, all_locations, res) {

	//WRITE THE HEADER
	res.writeHead(200, { 'Content-Type': 'text/html' });
	let msg = "";

	//FORMAT THE METADATA, BODY AND TITLE CONTAINER
	msg = "<head><meta name='viewport' charset=utf-8 content='width=device-width, autoRotate:disabled, initial-scale=1.0'><title>You got it!</title></head>";
	msg += "<body style='font-size: 110%; background-image:url(https://www.databankimx.com/wp-content/uploads/2015/07/Microsoft-Cloud-Offerings.jpg); background-repeat:repeat;'>";
	msg += '<p style="text-align:center; font-size:20px; margin:20px;"><span style="font-size:40px;"><a id="top" style="text-decoration: none;" href="http://localhost:3000">&#127968</span></br><u>HOME</u></a></p>';
	msg += "<div style=' width:80%; margin:25px auto; background-color: white; opacity:0.70;border-style:solid; border-radius:15px; border-color:rgb(19, 102, 235); padding:20px;'>";

	//CASE THERE IS NOT DATA RETURNED FROM TWITTER, SERVE THIS PAGE
	if (arr == undefined || arr.length == 0) {
		msg += '<div style="text-align:center; margin:40px auto; padding 20px;"><h3> The search terms did not return any results </h3></div></div>';
		res.end(msg);
	}

	//ELSE INSTRUCT USER TO CLICK ON MAP OR TWEET TO EXPLORE FURTHER
	msg += "<h3 style='text-align:center; margin: 10px auto;'>Click on Tweets to view on Twitter</h3><hr>";
	msg += "<h3 style='text-align:center; margin: 10px auto;'>Click on Maps to explore on Google Maps</h3></div>";
	let i = 0

	//FORMAT DATA INTO STYLED TAGS

	//DATA CAN BE FOUND IN A COUPLE OF PLACES IN THE TWITTER OBJECT
	for (i in arr) {
		//first check existence of larger text data, if so add it to styled tags
		if (arr[i].hasOwnProperty("retweeted_status")) {
			if (arr[i].retweeted_status.hasOwnProperty("extended_tweet"))
				if (arr[i].retweeted_status.extended_tweet.hasOwnProperty("full_text")) {
					let link = "https://twitter.com/i/web/status/" + arr[i].id_str;
					msg += "<a target=_blank style='text-decoration: none; color:#000000;' href=" + link + ">";
					msg += "<div style=' width:80%; margin:25px auto; background-color: white; opacity:0.95;border-style:solid; border-radius:15px; border-color:rgb(19, 102, 235); padding:20px;'><p><b> " + arr[i].user.name + "</b></br></br>" + arr[i].retweeted_status.extended_tweet.full_text + "</br></br><em> - " + arr[i].place.full_name + "</em></p></br>";
					msg += "</a>";
					msg += "<a target=_blank href=http://maps.google.com/?q=".concat(encodeURI(arr[i].place.full_name)).concat(">");
					msg += "<div style='margin: 15px auto; width:100%; text-align:center;'><img style='text-align:center; width:100%; border:1px solid gray; border-radius:15px;' src=mapCache/".concat(encodeURI((arr[i].place.full_name).replace(/[ ]/g, ""))) + ".jpg></div></div>";
					msg += "</a>";
				}
		}

		//second, check secondary extended data, if so, add to styled tags
		else if (arr[i].hasOwnProperty("extended_tweet")) {
			if (arr[i].extended_tweet.hasOwnProperty("full_text")) {
				let link = "https://twitter.com/i/web/status/" + arr[i].id_str;
				msg += "<a target=_blank style='text-decoration: none; color:#000000;' href=" + link + ">";
				msg += "<div style=' width:80%; margin:25px auto; background-color: white; opacity:0.95; border-style:solid; border-radius: 15px; border-color:rgb(19, 102, 235);padding:20px;'><p><b> " + arr[i].user.name + "</b></br></br>" + arr[i].extended_tweet.full_text + "</br></br><em> - " + arr[i].place.full_name + "</em></p></br>";
				msg += "</a>";
				msg += "<a target=_blank href=http://maps.google.com/?q=".concat(encodeURI(arr[i].place.full_name)).concat(">");
				msg += "<div style='margin: 15px auto; width:100%;text-align:center;'> <img style='text-align:center; width:100%; border:1px solid gray; border-radius:15px;' src=mapCache/".concat(encodeURI((arr[i].place.full_name).replace(/[ ]/g, ""))) + ".jpg></div></div>";
				msg += "</a>";
			}
		}
		//else add plain text data to styled tags.
		else if (arr[i].hasOwnProperty("text")) {
			let link = "https://twitter.com/i/web/status/" + arr[i].id_str;
			msg += "<a target=_blank style='text-decoration: none; color:#000000;' href=" + link + ">";
			msg += "<div style=' width:80%; margin:25px auto; background-color: white; opacity:0.95; border-style:solid; border-radius: 15px; border-color:rgb(19, 102, 235);padding:20px;'><p><b> " + arr[i].user.name + "</b></br></br>" + arr[i].text + "</br></br><em> - " + arr[i].place.full_name + "</em></p></br>";
			msg += "</a>";
			msg += "<a target=_blank href=http://maps.google.com/?q=".concat(encodeURI(arr[i].place.full_name)).concat(">");
			msg += "<div style='margin: 15px auto; width:100%;text-align:center;'> <img style='text-align:center; width:100%; border:1px solid gray; border-radius:15px;' src=mapCache/".concat(encodeURI((arr[i].place.full_name).replace(/[ ]/g, ""))) + ".jpg></div></div>";
			msg += "</a>";
		}
	}
	//FUN FACT
	msg += '<p style="text-align:center; font-size:20px;"><a href="#top" style="text-decoration:none;">BACK TO TOP</a></p>';
	msg += '<p style="text-align:center; font-size:30px;">Powered by&nbsp;<span style="font-size:40px;">&#9749;</span></p>';
	res.end(msg);
}
