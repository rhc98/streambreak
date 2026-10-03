// Synthetic feeds shaped like the three real defaults (checked against live copies on
// 2026-10-03), with made-up headlines: no third-party content is stored in the repo.

/** hnrss.org/frontpage: RSS 2.0, CDATA titles, `+0000` pubDate, link after description. */
export const HN_RSS = `<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Hacker News: Front Page</title><link>https://news.ycombinator.com/</link><atom:link href="https://hnrss.org/frontpage" rel="self" type="application/rss+xml"></atom:link><item><title><![CDATA[Show HN: A tiny <b>parser</b> & friends]]></title><description><![CDATA[
<p>Article URL: <a href="https://example.com/hn-1">https://example.com/hn-1</a></p>
]]></description><pubDate>Sat, 03 Oct 2026 04:53:57 +0000</pubDate><link>https://example.com/hn-1</link><dc:creator>someone</dc:creator><guid isPermaLink="false">https://news.ycombinator.com/item?id=1</guid></item><item><title><![CDATA[Second story]]></title><description><![CDATA[<p>x</p>]]></description><pubDate>Sat, 03 Oct 2026 02:00:00 +0000</pubDate><link>https://example.com/hn-2</link></item></channel></rss>`

/** techcrunch.com/feed: RSS 2.0, plain titles with numeric entities, indented XML. */
export const TC_RSS = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:atom="http://www.w3.org/2005/Atom"
	>
<channel>
	<title>TechCrunch</title>
	<atom:link href="https://techcrunch.com/feed/" rel="self" type="application/rss+xml" />
	<link>https://techcrunch.com/</link>
	<item>
		<title>It&#8217;s a startup&#8217;s &#8216;big&#8217; day &amp; more&#8230;</title>
		<link>https://example.com/tc-1?a=1&amp;b=2</link>
		<dc:creator><![CDATA[A Writer]]></dc:creator>
		<pubDate>Sat, 03 Oct 2026 00:45:39 +0000</pubDate>
		<category><![CDATA[AI]]></category>
		<description><![CDATA[Summary.]]></description>
	</item>
	<item>
		<title>Undated piece</title>
		<link>https://example.com/tc-2</link>
	</item>
</channel>
</rss>`

/** news.hada.io/rss/news: Atom, single-quoted attributes, `+09:00` offsets, CDATA titles. */
export const GN_ATOM = `<?xml version='1.0' encoding='UTF-8'?>
<feed xmlns='http://www.w3.org/2005/Atom'>
<title>GeekNews</title>
<link rel='alternate' type='text/html' href='https://news.hada.io' />
<link rel='self' type='application/atom+xml' href='https://news.hada.io/rss/news' />
<entry>
  <title><![CDATA[한글 제목 테스트]]></title>
  <link rel='alternate' type='text/html' href='https://example.com/gn-1' />
  <id>https://example.com/gn-1</id>
  <updated>2026-10-03T16:32:55+09:00</updated>
  <published>2026-10-03T16:32:55+09:00</published>
  <author><name>neo</name></author>
  <content type='html'><![CDATA[<ul><li>본문</li></ul>]]></content>
</entry>
<entry>
  <title><![CDATA[Updated only]]></title>
  <link href='https://example.com/gn-2' />
  <updated>2026-10-02T09:00:00+09:00</updated>
</entry>
</feed>`
