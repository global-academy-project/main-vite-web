import { Component } from 'react';
import StatusView from './status-view.jsx';

/**
 * 영역별 에러 경계. 안쪽 화면이 그리다 실패해도 그 영역만 "불러올 수 없음"으로 바뀌고 앱 전체는 계속 동작한다.
 * resetKeys 값이 바뀌면(예: 현장 변경) 자동으로 다시 그린다.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, keys: props.resetKeys ?? [] };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  static getDerivedStateFromProps(props, state) {
    const keys = props.resetKeys ?? [];
    const changed = keys.length !== state.keys.length || keys.some((key, index) => !Object.is(key, state.keys[index]));
    return changed ? { error: null, keys } : null;
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  retry() {
    this.setState({ error: null });
    this.props.onReset?.();
  }

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback({ error: this.state.error, retry: this.retry });
    return (
      <StatusView
        kind="error"
        title={this.props.title ?? '이 영역을 표시하지 못했습니다'}
        message="다른 화면은 계속 사용할 수 있습니다."
        onRetry={this.retry}
        compact={this.props.compact}
      />
    );
  }
}
