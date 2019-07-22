import React from 'react';
import moment from 'moment';
import {
  Icon
} from 'fabric';
function formatDuration(v) {
  if (v < 1000) return v + 'ms';
  v /= 1000;
  if (v < 60) return (Math.round(v * 10) / 10) + 's';
  return (Math.round(v / 60 * 10) / 10) + 'm';
}

export default class Record extends React.Component {
  constructor(props) {
    super(props);
    this._recordChangedHandler = this._onRecordChanged.bind(this);
    this._record = props.record;
  }

  componentDidMount() {
    this._record.on('state-changed', this._recordChangedHandler);
  }

  componentWillUnmount() {
    this._record.off('state-changed', this._recordChangedHandler);
  }

  _onRecordChanged() {
    this.setState({});
  }

  _onClick() {
    this.props.onClick(this._record);
  }

  render() {
    const r = this._record;
    return (
      <li className={'record' + (this.props.isActive ? ' active' : '')} onClick={this._onClick.bind(this)}>
        <div className="title">
          <span className="method">{
            r.request ? r.request.method.toUpperCase() : (
              <Icon iconName="Lock"/>
            )}
          </span>
          <span className="host">{r.host}</span>
        </div>
        <div className="path">
          {r.request ? r.path : (
            <span style={{ color: '#666' }}>encoded https request/response</span>
          )}
        </div>
        <div className="info">
          <span className="time">{moment(r.startAt).format('HH:MM:ss')}</span>
          {r.state === 'finish' || r.state === 'error' ? (
            <span className="duration">{formatDuration(r.duration)}</span>
          ) : (
            <span className="pending">pending</span>
          )}
          {r.state === 'finish' && (
            <span className={'status'}>{r.response.statusCode}</span>
          )}
          {r.state === 'error' && (
            <span className="error">error</span>
          )}
        </div>    
      </li>
    );
  }
}
