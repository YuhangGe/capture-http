import React from 'react';
import {
  Pivot,
  PivotItem,
  TextField,
  PivotLinkSize,
  MessageBar,
  DefaultButton,
  Spinner,
  SpinnerSize,
  IconButton,
  Icon
} from 'fabric';
import message from 'notify';
import moment from 'moment';
import {
  manager as settingManager
} from '../service/setting';
import find from 'lodash-es/find';

export default class Setting extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      curTab: 'url', // settingManager.ca ? 'host' : 'ca',
      newHost: false,
      newProxy: false,
      _caing: false,
      caForm: {
        country: '',
        state: '',
        city: '',
        org: '',
        orgUnit: '',
        commonName: ''
      },
      hostForm: {
        domain: ''
      },
      proxyForm: {
        url: '',
        target: ''
      }
    };
  }

  onTabClick(item) {
    this.setState({ curTab: item.props.itemKey });
  }

  _onCAFormInput(prop, ev, val) {
    const { caForm } = this.state;
    caForm[prop] = val;
    this.setState({ caForm });
  }

  _onProxyFormInput(prop, ev, val) {
    const { proxyForm } = this.state;
    proxyForm[prop] = val;
    this.setState({ proxyForm });
  }

  _onHostFormInput(prop, ev, val) {
    const { hostForm } = this.state;
    hostForm[prop] = val;
    this.setState({ hostForm });
  }

  _addProxy() {
    const { proxyForm } = this.state;
    const url = proxyForm.url.trim();
    if (!url) {
      return message.error('URL 不能为空');
    }
    if (!/^http(?:s?):\/\//.test(url)) {
      return message.error('URL 格式错误，必须是完整的 URL');
    }
    if (find(settingManager.proxies, h => h.url === url)) {
      return message.error('URL 已经存在，不能重复。');
    }
    const target = proxyForm.target.trim();
    if (!target) {
      return message.error('目标路径不能为空。');
    }
    if (!/^file:\/\//.test(target)) {
      return message.error('目标路径格式错误，当前版本只支持映射本地文件。');
    }
    settingManager.addProxy({
      url,
      target,
      enabled: true
    });
    this.setState({
      newProxy: false
    });
  }

  _addHost() {
    const { hostForm } = this.state;
    const domain = hostForm.domain.trim();
    if (!domain) {
      return message.error('域名不能为空');
    }
    if (find(settingManager.hosts, h => h.domain === domain)) {
      return message.error('域名已经存在');
    }
    const m = domain.match(/[^.]+\.[^.]+$/);
    if (!m) {
      return message.error('域名格式不正确！');
    }
    if (!settingManager.addHost({
      domain,
      rootDomain: '*.' + m[0],
      enabled: true
    })) {
      return message.error('添加失败');
    }
    this.setState({
      newHost: false
    });
  }

  genCA() {
    this.setState({ _caing: true });
    const caForm = this.state.caForm;
    settingManager
      .generateCA([{
        name: 'commonName',
        value: caForm.commonName || 'Capture HTTP(s) Root CA'
      }, {
        name: 'countryName',
        value: caForm.country || 'CN'
      }, {
        shortName: 'ST',
        value: caForm.state || 'SiChuan'
      }, {
        name: 'localityName',
        value: caForm.city || 'Chengdu'
      }, {
        name: 'organizationName',
        value: caForm.org || 'Capture HTTP(s) Ltd'
      }, {
        shortName: 'OU',
        value: caForm.orgUnit || 'capture'
      }]).then(() => {
        message.success('生成 CA 证书成功');
      }, err => {
        message.error('生成 CA 证书失败', err.message);
        console.error(err);
      }).finally(() => {
        this.setState({ _caing: false });
      });
  }

  _rmProxy(proxy) {
    settingManager.rmProxy(proxy);
    this.setState({});
  }

  _rmHost(host) {
    settingManager.rmHost(host);
    this.setState({});
  }

  _toggleHost(host) {
    if (host.enabled) settingManager.disableHost(host);
    else settingManager.enableHost(host);
    this.setState({});
  }

  renderCA() {
    const ca = settingManager.ca;
    const caForm = this.state.caForm;
    return (
      <div className="form">
        <MessageBar>以下表单内容用于生成 CA 证书，可直接使用默认值</MessageBar>
        <TextField
          value={caForm.country}
          onChange={this._onCAFormInput.bind(this, 'country')}
          placeholder="Country Name (2 letter code), default: CN"
        />
        <TextField
          value={caForm.state}
          onChange={this._onCAFormInput.bind(this, 'state')}
          placeholder="State or Province Name (full name), default: SiChuan"
        />
        <TextField
          value={caForm.city}
          onChange={this._onCAFormInput.bind(this, 'city')}
          placeholder="Locality Name (eg, city), default: Chengdu"
        />
        <TextField
          value={caForm.org}
          onChange={this._onCAFormInput.bind(this, 'org')}
          placeholder="Organization Name (eg, company), default: Capture HTTP(s) Ltd"
        />
        <TextField
          value={caForm.orgUnit}
          onChange={this._onCAFormInput.bind(this, 'orgUnit')}
          placeholder="Organizational Unit Name (eg, section), default: capture"
        />
        <TextField
          value={caForm.commonName}
          onChange={this._onCAFormInput.bind(this, 'commonName')}
          placeholder="Common Name, default: Capture HTTP(s) Root CA"
        />
        <div className="ctrl">
          {ca && (
            <span style={{ marginRight: 8 }}>
              CA 证书生成时间：{moment(ca.mtime).format('YYYY-MM-DD HH:MM:ss')}
            </span>
          )}
          <DefaultButton
            primary={true}
            disabled={this.state._caing}
            onClick={this.genCA.bind(this)}
          >
            {this.state._caing && <Spinner size={SpinnerSize.small} />}
            {ca ? '重新' : ''}生成 CA 证书
          </DefaultButton>
        </div>
      </div>
    );
  }

  renderHost() {
    const { ca, hosts } = settingManager;
    const { hostForm } = this.state;
    if (!ca) return <div>还未生成 CA 证书，请先配置 CA 证书</div>;
    return this.state.newHost ? (
      <div className="form">
        <MessageBar>添加待解码 HTTPS 的域名，需要完整形式</MessageBar>
        <div className="outer">
          <TextField
            value={ hostForm.domain }
            onChange={this._onHostFormInput.bind(this, 'domain')}
            placeholder="Domain, eg. www.baidu.com"
          />
        </div>
        <div className="ctrl">
          <DefaultButton
            onClick={() => this.setState({ newHost: false })}
          >
            取消
          </DefaultButton>
          <DefaultButton
            primary={true}
            onClick={this._addHost.bind(this)}
          >
            保存
          </DefaultButton>
        </div>
      </div>
    ) : (
      <div className="form">
        <MessageBar>此处配置需要进行 HTTPS 解码的域名</MessageBar>
        <div className="outer">
          <table className="table">
            <thead>
              <tr>
                <th>域名</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {hosts.map((item, i) => (
                <tr key={i}>
                  <td>{item.domain}</td>
                  <td>
                    <Icon iconName={item.enabled ? 'Accept' : 'Blocked'}/>
                  </td>
                  <td>
                    <div style={{ display: 'flex' }}>
                      <IconButton
                        className="ms-fontColor-themePrimary"
                        onClick={this._toggleHost.bind(this, item)}
                        iconProps={{ iconName: item.enabled ? 'CirclePauseSolid' : 'BoxPlaySolid' }}
                      />
                      <IconButton
                        className="ms-fontColor-themePrimary"
                        onClick={this._rmHost.bind(this, item)}
                        iconProps={{ iconName: 'Delete' }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ctrl">
          <DefaultButton
            primary={true}
            onClick={() => this.setState({ newHost: true, hostForm: { domain: '' } })}
          >
            添加域名
          </DefaultButton>
        </div>
      </div>
    );
  }

  renderProxy() {
    const { proxies } = settingManager;
    const { proxyForm } = this.state;
    return this.state.newProxy ? (
      <div className="form">
        <MessageBar>
          添加 URL 映射规则，当前版只支持本地文件 <code>file://...</code>
        </MessageBar>
        <div className="outer">
          <TextField
            value={ proxyForm.url }
            onChange={this._onProxyFormInput.bind(this, 'url')}
            placeholder="URL"
          />
          <div className="url-map-target">
            <span>==></span>
            <TextField
              value={ proxyForm.target }
              onChange={this._onProxyFormInput.bind(this, 'target')}
              placeholder="Target"
            />
          </div>
        </div>
        <div className="ctrl">
          <DefaultButton
            onClick={() => this.setState({ newProxy: false })}
          >
            取消
          </DefaultButton>
          <DefaultButton
            primary={true}
            onClick={this._addProxy.bind(this)}
          >
            保存
          </DefaultButton>
        </div>
      </div>
    ) : (
      <div className="form">
        <MessageBar>URL 映射列表：</MessageBar>
        <ul className="proxyList">
          {proxies.map((proxy, idx) => (
            <li key={idx}>
              <div>
                <TextField
                  value={ proxy.url }
                  readOnly
                  placeholder="URL"
                />
                <div className="url-map-target">
                  <span>==></span>
                  <TextField
                    value={ proxy.target }
                    readOnly
                    placeholder="Target"
                  />
                </div>
              </div>
              <IconButton
                className="ms-fontColor-themePrimary"
                onClick={this._rmProxy.bind(this, proxy)}
                iconProps={{ iconName: 'Delete' }}
              />
            </li>
          ))}
        </ul>
        <div className="ctrl">
          <DefaultButton
            primary={true}
            onClick={() => this.setState({ newProxy: true, proxyForm: { url: '', target: '' } })}
          >
            添加规则
          </DefaultButton>
        </div>
      </div>
    );
  }

  render() {
    const { curTab } = this.state;
    return (
      <div>
        <Pivot
          linkSize={PivotLinkSize.large}
          selectedKey={curTab}
          onLinkClick={this.onTabClick.bind(this)}
        >
          <PivotItem headerText="HTTPS 域名" itemKey="host" />
          <PivotItem headerText="CA 证书" itemKey="ca" />
          <PivotItem headerText="URL 映射" itemKey="url" />
        </Pivot>
        {curTab === 'ca' && this.renderCA()}
        {curTab === 'host' && this.renderHost()}
        {curTab === 'url' && this.renderProxy() }
      </div>
    );
  }
}
