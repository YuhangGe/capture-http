import './service/polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import App from './component/App';
import proxyServer from './service/proxy_server';

proxyServer.initialize().then(() => {
  ReactDOM.render(<App/>, document.getElementById('react-root-app'));
});