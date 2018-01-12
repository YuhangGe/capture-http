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
import settingManager from '../service/setting_manager';
import find from 'lodash-es/find';

export default class Setting extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      curTab: settingManager.ca ? 'host' : 'ca',
      newHost: false,
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
      }
    };
  }
  onTabClick(item) {
    this.setState({ curTab: item.props.itemKey });
  }
  _onCAFormInput(prop, val) {
    const { caForm } = this.state;
    caForm[prop] = val;
    this.setState({ caForm });
  }
  _onHostFormInput(prop, val) {
    const { hostForm } = this.state;
    hostForm[prop] = val;
    this.setState({ hostForm });
  }
  _addHost() {
    const { hostForm } = this.state;
    let domain = hostForm.domain.trim();
    if (!domain) {
      return message.error('域名不能为空');
    }
    if (!/^[^.]+\.[^.]+$/.test(domain)) {
      return message.error('域名格式错误，只需要输入根域名');
    }
    domain = '*.' + domain;
    if (find(settingManager.hosts, h => h.domain === domain)) {
      return message.error('域名已经存在');
    }
    if (!settingManager.addHost({
      domain: domain,
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
          onChanged={this._onCAFormInput.bind(this, 'country')}
          placeholder="Country Name (2 letter code), default: CN"
        />
        <TextField
          value={caForm.state}
          onChanged={this._onCAFormInput.bind(this, 'state')}
          placeholder="State or Province Name (full name), default: SiChuan"
        />
        <TextField
          value={caForm.city}
          onChanged={this._onCAFormInput.bind(this, 'city')}
          placeholder="Locality Name (eg, city), default: Chengdu"
        />
        <TextField
          value={caForm.org}
          onChanged={this._onCAFormInput.bind(this, 'org')}
          placeholder="Organization Name (eg, company), default: Capture HTTP(s) Ltd"
        />
        <TextField
          value={caForm.orgUnit}
          onChanged={this._onCAFormInput.bind(this, 'orgUnit')}
          placeholder="Organizational Unit Name (eg, section), default: capture"
        />
        <TextField
          value={caForm.commonName}
          onChanged={this._onCAFormInput.bind(this, 'commonName')}
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
        <MessageBar>请添加根域名，其下所有域名都生效</MessageBar>
        <div className="outer">
          <TextField
            value={ hostForm.domain }
            onChanged={this._onHostFormInput.bind(this, 'domain')}
            placeholder="Domain, eg. google.com"
          />
        </div>
        <div className="ctrl">
          <DefaultButton
            onClick={() => this.setState({newHost: false})}
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
                    <div style={{display: 'flex'}}>
                      <IconButton
                        className="ms-fontColor-themePrimary"
                        onClick={this._toggleHost.bind(this, item)}
                        iconProps={{iconName: item.enabled ? 'CirclePauseSolid' : 'BoxPlaySolid'}}
                      />
                      <IconButton
                        className="ms-fontColor-themePrimary"
                        onClick={this._rmHost.bind(this, item)}
                        iconProps={{iconName: 'Delete'}}
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
            onClick={() => this.setState({newHost: true, hostForm: {domain: ''}})}
          >
            添加域名
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
          <PivotItem linkText="HTTPS 域名" itemKey="host" />
          <PivotItem linkText="CA 证书" itemKey="ca" />
          <PivotItem linkText="URL 代理" itemKey="url" />
        </Pivot>
        {curTab === 'ca' && this.renderCA()}
        {curTab === 'host' && this.renderHost()}
        {curTab === 'url' && <p>todo...</p> }
      </div>
    );
  }
}
