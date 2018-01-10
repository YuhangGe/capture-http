import React from 'react';
import Toolbar from './Toolbar';
import List from './List';
import Content from './Content';
import proxyServer from '../service/proxy_server';

export default class CaptureHttpApp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      activeRecord: proxyServer._records.length > 0 ? proxyServer._records[0] : null,
      records: proxyServer._records
    };
    this._recordsChangedHandler = this.onRecordsChanged.bind(this);
    this._captureChangedHandler = this._onCaptureChanged.bind(this);
  }
  onRecordClick(record) {
    if (this.state.activeRecord === record) return;
    this.setState({
      activeRecord: record
    });
  }
  componentDidMount() {
    proxyServer.on('records-changed', this._recordsChangedHandler);
    proxyServer.on('capture-changed', this._captureChangedHandler);
  }
  componentWillUnmount() {
    proxyServer.off('records-changed', this._recordsChangedHandler);
    proxyServer.off('capture-changed', this._captureChangedHandler);
  }
  _onCaptureChanged() {
    this.setState({});
  }
  onRecordsChanged() {
    const newState = {
      records: this.state.records
    };
    if (this.state.records.length > 0 && !this.state.activeRecord) {
      newState.activeRecord = this.state.records[0];
    } else if (this.state.records.length === 0 && this.state.activeRecord) {
      newState.activeRecord = null;
    }
    this.setState(newState);
  }
  startCapture() {
    proxyServer.startCapture();
  }
  render() {
    return (
      <div className="root-app">
        <Toolbar/>
        {this.state.records.length === 0 ? (
          <div className="main empty">
            <p>还没有捕获任何 HTTP(s) 请求</p>
            {proxyServer.isCapturing ? (
              <p>正在捕获中……</p>
            ) : (
              <p><a href="javascript:;" onClick={this.startCapture.bind(this)}>开始捕获</a></p>
            )}
          </div>
        ) : (
          <div className="main">
            <List activeRecord={this.state.activeRecord} records={this.state.records} onRecordClick={this.onRecordClick.bind(this)}/>
            <Content record={this.state.activeRecord}/>
          </div>
        )}
      </div>
    );
  }
}
