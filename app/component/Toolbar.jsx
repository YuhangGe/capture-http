import React from 'react';
import {
  IconButton,
  TextField,
  TooltipHost,
  DirectionalHint,
  Dropdown,
  Dialog,
  DialogType
} from 'fabric';
import Setting from './Setting';
import Info from './Info';
import proxyServer from '../service/proxy_server';
const PROTOCOLS = [
  { key: 'all', text: '全部' },
  { key: 'http', text: 'HTTP' },
  { key: 'https', text: 'HTTPS' }
];
const MIMES = [
  { key: 'all', text: '全部' },
  { key: 'image', text: '图片' },
  { key: 'text', text: '文本' },
  { key: 'json', text: 'JSON' }
];
const METHODS = [
  { key: 'all', text: '全部' },
  { key: 'get', text: 'GET' },
  { key: 'post', text: 'POST' },
  { key: 'put', text: 'PUT' },
  { key: 'delete', text: 'DELETE' },
  { key: 'head', text: 'HEAD' },
  { key: 'option', text: 'OPTION' }
];
export default class Toolbar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      filter: proxyServer.filter,
      showInfo: false,
      showSetting: false
    };
    this.$canvas = null;
    this._captureChangedHandler = this._onCaptureChanged.bind(this);
  }

  componentDidMount() {
    proxyServer.on('capture-changed', this._captureChangedHandler);
  }

  componentWillUnmount() {
    proxyServer.off('capture-changed', this._captureChangedHandler);
  }

  _onCaptureChanged() {
    this.setState({});
  }

  showQR() {
    this.setState({ showInfo: true });
  }

  closeQR() {
    this.setState({ showInfo: false });
  }

  openSetting() {
    this.setState({ showSetting: true });
  }

  closeSetting() {
    this.setState({ showSetting: false });
  }

  clear() {
    proxyServer.clearRecords();
  }

  toggle() {
    if (proxyServer.isCapturing) {
      proxyServer.stopCapture();
    } else {
      proxyServer.startCapture();
    }
  }

  onFilterChanged(prop, val) {
    const filter = this.state.filter;
    filter[prop] = val.key || val;
    this.setState({
      filter
    });
  }

  render() {
    const { filter } = this.state;
    return (
      <div className="toolbar">
        <TooltipHost
          content={proxyServer.isCapturing ? '暂停捕获请求' : '开始捕获请求'}
          directionalHint={ DirectionalHint.bottomCenter }
        >
          <IconButton
            onClick={this.toggle.bind(this)}
            style={{ color: proxyServer.isCapturing ? '#e81123' : null } }
            iconProps={ { iconName: proxyServer.isCapturing ? 'Stop' : 'Play' } }
          />
        </TooltipHost>
        <TooltipHost
          content='清空记录'
          directionalHint={ DirectionalHint.bottomCenter }
        >
          <IconButton
            onClick={this.clear.bind(this)}
            iconProps={ { iconName: 'Clear' } }
          />
        </TooltipHost>
        <i/>
        <Dropdown
          placeholder='Protocol'
          style={{ marginRight: 8, width: 102, marginLeft: 8 }}
          selectedKey={filter.protocol}
          onChange={this.onFilterChanged.bind(this, 'protocol')}
          options={PROTOCOLS}
        />
        <Dropdown
          placeholder='Method'
          style={{ marginRight: 8, width: 100 }}
          selectedKey={filter.method}
          onChange={this.onFilterChanged.bind(this, 'method')}
          options={METHODS}
        />
        <TextField
          placeholder='URL Filter'
          className="i-url"
          value={filter.url}
          onChange={this.onFilterChanged.bind(this, 'url')}
        />
        <TextField
          className="i-status"
          placeholder='Status'
          value={filter.status}
          onChange={this.onFilterChanged.bind(this, 'status')}
        />
        <Dropdown
          style={{ marginRight: 8, width: 86 }}
          placeholder='Mime'
          selectedKey={filter.mime}
          onChange={this.onFilterChanged.bind(this, 'mime')}
          options={MIMES}
        />
        <i/>
        <IconButton
          onClick={this.showQR.bind(this)}
          iconProps={ { iconName: 'Info2' } }
        />
        <IconButton
          onClick={this.openSetting.bind(this)}
          iconProps ={ { iconName: 'Settings' } }
        />
        <Dialog
          hidden={ !this.state.showInfo }
          onDismiss={ this.closeQR.bind(this) }
          dialogContentProps={ {
            type: DialogType.largeHeader,
            title: '系统信息'
          } }
          modalProps={ {
            isBlocking: false,
            containerClassName: 'proxyServerDialog'
          } }
        >
          <Info/>
        </Dialog>
        <Dialog
          hidden={ !this.state.showSetting }
          onDismiss={ this.closeSetting.bind(this) }
          dialogContentProps={ {
            type: DialogType.largeHeader,
            title: (
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ flex: 1 }}>系统配置</span>
                <IconButton
                  onClick={this.closeSetting.bind(this)}
                  iconProps={ { iconName: 'ChromeClose', style: { color: '#fff' } } }
                />
              </span>
            )
          } }
          modalProps={ {
            isBlocking: true,
            containerClassName: 'systemSettingDialog'
          } }
        >
          <Setting/>
        </Dialog>
      </div>
    );
  }
}
