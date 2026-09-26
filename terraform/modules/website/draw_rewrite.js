function handler(event) {
  var request = event.request;
  var uri = request.uri;

  if (uri === '/ko/blog' || uri === '/ko/blog/' || uri.indexOf('/ko/blog/') === 0) {
    var englishUri = uri === '/ko/blog' || uri === '/ko/blog/'
      ? '/articles.html'
      : '/blog' + uri.substring('/ko/blog'.length);
    var rawQueryString = request.rawQueryString();
    var querySuffix = rawQueryString === undefined ? '' : '?' + rawQueryString;
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: {
          value: 'https://www.yopa.page' + englishUri + querySuffix
        }
      }
    };
  }

  if (uri === '/draw' || uri === '/draw/') {
    request.uri = '/draw/index.html';
  } else if (uri === '/explore' || uri === '/explore/') {
    request.uri = '/explore/index.html';
  }

  return request;
}
