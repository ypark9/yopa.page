// Korean URLs that no longer have a Korean page. Each entry is
// [prefix, index target]. A request for the bare prefix (with or without a
// trailing slash) goes to the index target; anything below the prefix keeps
// its remaining path and drops the leading "/ko".
var RETIRED_KOREAN_PREFIXES = [
  ['/ko/blog', '/articles.html'],
  ['/ko/tags', '/tags/index.html'],
  ['/ko/categories', '/categories/index.html'],
  ['/ko/page', '/articles.html']
];

// Korean pages that were never built or were retired with the blog.
var RETIRED_KOREAN_PAGES = {
  '/ko/articles.html': '/articles.html',
  '/ko/explore': '/explore/',
  '/ko/explore/': '/explore/'
};

function englishTarget(uri) {
  if (RETIRED_KOREAN_PAGES[uri]) {
    return RETIRED_KOREAN_PAGES[uri];
  }
  for (var i = 0; i < RETIRED_KOREAN_PREFIXES.length; i++) {
    var prefix = RETIRED_KOREAN_PREFIXES[i][0];
    if (uri === prefix || uri === prefix + '/') {
      return RETIRED_KOREAN_PREFIXES[i][1];
    }
    if (uri.indexOf(prefix + '/') === 0) {
      // Paginated Korean home pages have no English equivalent path.
      return prefix === '/ko/page' ? '/articles.html' : uri.substring('/ko'.length);
    }
  }
  return undefined;
}

function handler(event) {
  var request = event.request;
  var uri = request.uri;

  var target = englishTarget(uri);
  if (target !== undefined) {
    var rawQueryString = request.rawQueryString();
    var querySuffix = rawQueryString === undefined ? '' : '?' + rawQueryString;
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: {
          value: 'https://www.yopa.page' + target + querySuffix
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
