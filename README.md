# NodeJS-TwitterAPI-GoogleMapsAPI

Broadly speaking, the user fills the form served by accessing the root of the server. Upon submitting it, the user
data is parsed and verified. That data is used to request data from a first API. Data received from that API is parsed
and used to request data from a second API. Both sets of data are intertwined and a response is served to the user.

That is a general idea of what the program accomplishes. However, in and between those steps are a myriad of tasks
that happen in order to enforce proper functionality. Aiming to detail the program flow more in depth, I decided to
add the algorithm below to provide more information to interested parties.

## Server Structure

### Folders
auth - stores the access token and expiration in file authorization-res.json   
credentials - stores the key and secret used to acquire an access token   
html - stores an HTML file describing a form that the user can fill out and send information to the server   
images - stores favicon, 404.jpg and map placeholder case a place does not have a map   
mapCache - stores static map images to be used as cache for future users   
twitterCache - stores query sent to and data received from Twitter as response   
index.js - the file with the instructions to instantiate the server for this assignment   

### Server Algorithm   

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

**NOTE:** Unauthorized access to directories or by injecting information to url should not cause error or break the server.

**PS:** You can pull and use the cached searches to test the site. Case you acquire the premium twitter API key/secret (to access geo location) and a Google Maps (static map) API, please add those to the indicated directories mentioned above and revert the ```javascript if (now > cached_Time)``` to ``` javascript if (now < cached_Time)``` on line 212 of index.js to revert to a cache expiration of 15 minutes.   

Lastly, make sure to check the 'User Form' and 'Sample Result' to see the server form to the user and the served page for a Twitter search of 'keyword' 'cats' in 'English'.    

---

*Vagner*   
