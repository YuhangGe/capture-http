import React from 'react';
import Record from './Record';

export default class List extends React.Component {
  constructor(props) {
    super(props);
  }
  _onRecordClick(record) {
    this.props.onRecordClick(record);
  }
  render() {
    return (
      <ul className="record-list">
        {this.props.records.map(record => (
          <Record isActive={this.props.activeRecord === record} onClick={this._onRecordClick.bind(this)} key={record.id} record={record}/>
        ))}
      </ul>
    );
  }
}
