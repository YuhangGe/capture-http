import React from 'react';
import JSHexGrid from 'jshex';

export default class HexViewer extends React.Component {
  constructor(props) {
    super(props);
    this.$hexViewer = null;
  }
  componentDidMount() {
    if (!this.$hexViewer) return;
    const grid = new JSHexGrid.grid({
      rows: this.props.rows || 12,
      container: this.$hexViewer,
      dataSrc: {
        getSize: () => this.props.body.length,
        getByteArray: (start, end, cb) => {
          cb(this.props.body.slice(start, end));
        }
      },
      colors: Object.assign({}, JSHexGrid.theme['light'], {
        background: '#fff'
      })
    });
    if(grid) {
      const dimensions = grid.getDimensions();
      this.$hexViewer.innerHTML = '';
      this.$hexViewer.style.width = dimensions.width + 'px';
      this.$hexViewer.style.height = dimensions.height + 'px';
      grid.render();
      grid.showFrom(0);
    }
  }
  componentWillUnmount() {
    this.$hexViewer && (this.$hexViewer.innerHTML = '');
  }
  render() {
    return (
      <div
        className="hex-viewer-container"
        ref={$v => this.$hexViewer = $v}
      />
    );
  }
}


