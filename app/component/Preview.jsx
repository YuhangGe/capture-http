import React from 'react';
const hijs = require('highlight.js');
const zlib = require('zlib');
function isText(ct) {
  return ct.startsWith('text/') || /\b(json|xml|javascript)\b/.test(ct);
}
export default class Preview extends React.Component {
  render() {
    let body = this.props.body;
    if (body.length > 1024 * 1024) {
      return <div className="preview not-support">文件太大，请下载后预览</div>;
    }
    const ce = this.props.contentEncoding || null;
    if (ce === 'gzip') {
      body = zlib.gunzipSync(body);
    } else if (ce === 'deflate') {
      body = zlib.inflateSync(body);
    } else if (ce) {
      return <div className="preview not-support">不支持预览 {ce} 编码类型</div>;
    }
    const ct = this.props.contentType || 'raw';
    if (ct.startsWith('image/')) {
      const src = `data:${ct};base64, ${body.toString('base64')}`;
      return (
        <div className="preview image">
          <img src={src} />
        </div>
      );
    } else if (isText(ct)) {
      const code = body.toString('utf-8');
      const maxLen = 4 * 1024;
      return (
        <div className="preview text">
          <div dangerouslySetInnerHTML={{ __html: hijs.highlightAuto(code.length > maxLen ? code.substr(0, maxLen) : code).value }}/>
          {code.length > maxLen && (
            <div className="more">...更多内容请下载后预览</div>
          )}
        </div>
      );
    } else {
      return <div className="preview not-support">不支持该类型</div>;
    }
  }
}
