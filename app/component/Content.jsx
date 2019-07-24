import React from 'react';
import {
  Pivot, PivotItem,
  PivotLinkFormat,
  PivotLinkSize
} from 'fabric';
import HexViewer from './HexViewer';
import Preview from './Preview';
export default class Content extends React.Component {
  constructor(props) {
    super(props);
    this._recordChangedHandler = this._onRecordChanged.bind(this);
    this.state = {
      current: 'response',
      view: 'preview'
    };
  }

  componentDidMount() {
    this.props.record.on('state-changed', this._recordChangedHandler);
  }

  componentWillUnmount() {
    this.props.record.off('state-changed', this._recordChangedHandler);
  }

  _onRecordChanged() {
    this.setState({});
  }

  onViewTabClick(item) {
    this.setState({
      view: item.props.itemKey
    });
  }

  onTypeTabClick(item) {
    this.setState({
      current: item.props.itemKey
    });
  }

  renderPreview(r, headers) {
    if (r.preview) return r.preview;
    r.preview = (
      <Preview
        body={r.body}
        contentType={headers['content-type']}
        contentEncoding={headers['content-encoding']}
      />
    );
    return r.preview;
  }

  render() {
    const r = this.props.record;
    const { request, response } = r;
    const current = this.state.current === 'request' ? request : response;
    const headers = current && current.headers ? current.headers : null;
    const body = current && current.body && current.body.length > 0 ? current.body : null;
    return (
      <div className="content record-detail">
        <div className="title">
          http{r.isHttps ? 's' : ''}://{r.host}{r.path}
        </div>
        <div className="tabs">
          <Pivot
            selectedKey={this.state.current}
            onLinkClick={this.onTypeTabClick.bind(this)}
            linkFormat={ PivotLinkFormat.tabs }
            linkSize={ PivotLinkSize.normal }
          >
            <PivotItem itemKey='request' headerText='Request'>
            </PivotItem>
            <PivotItem itemKey='response' headerText='Response'>
            </PivotItem>
          </Pivot>
        </div>
        <div className="detail">
          <div className="h">Headers</div>
          {request ? (
            <table>
              <tbody>
                {headers && Object.keys(headers).map(k => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td>{headers[k]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">encoded https {this.state.current}</p>
          )}
          <div className="h">Body</div>
          {body ? (
            <div className="body">
              <Pivot
                selectedKey={this.state.view}
                onLinkClick={this.onViewTabClick.bind(this)}
              >
                <PivotItem itemKey='preview' headerText='preview'>
                </PivotItem>
                <PivotItem itemKey='source' headerText='source'>
                </PivotItem>
              </Pivot>
              {this.state.view === 'preview' ? (
                this.renderPreview(current, headers)
              ) : (
                <HexViewer body={current.body} />
              )}
            </div>
          ) : (
            <div className="body">
              <p className="empty">(空)</p>
            </div>
          )}
        </div>
      </div>
    );
  }
}
