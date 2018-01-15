import React from 'react';
import QRCode from 'qrcode';
import proxyServer from '../service/proxy_server';
import settingManager from '../service/setting_manager';

const ip = require('ip');

export default class Info extends React.Component {
  constructor(props) {
    super(props);
    this.$psCnavas = null;
    this.$cdCanvas = null;
  }
  componentDidMount() {
    this.drawProxyServerQR();
    this.drawCertDownloadQR();
  }
  drawProxyServerQR() {
    this.$psCanvas && QRCode.toCanvas(this.$psCanvas, JSON.stringify({
      type: 'HTTP',
      host: ip.address(),
      port: proxyServer.port
    }), {
      width: 200
    });
  }
  drawCertDownloadQR() {
    this.$cdCanvas && QRCode.toCanvas(
      this.$cdCanvas, 
      `http://${ip.address()}:${proxyServer.certDownloadServer.port}`,
      {
        width: 200
      }
    );
  }
  render() {
    return (
      <ul className="container">
        <li>
          <p>
            代理服务器地址
          </p>
          <p>
            <canvas ref={$c => this.$psCanvas = $c}/>
          </p>
          <p>
            http://{ip.address()}:{proxyServer.port}
          </p>
        </li>
        <li>
          <p>
            CA 证书下载地址
          </p>
          <p>
            <canvas ref={$c => this.$cdCanvas = $c}/>
          </p>
          <p>
            {settingManager.ca ? (
              <span>http://{ip.address()}:{proxyServer.certDownloadServer.port}</span>
            ) : (
              <span>还未生成 CA 证书</span>
            )}
          </p>
        </li>
      </ul>
    );
  }
}