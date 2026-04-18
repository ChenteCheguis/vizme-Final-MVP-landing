import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-vizme-red" />
          </div>
          <h2 className="text-lg font-bold text-vizme-navy mb-2">Algo salió mal</h2>
          <p className="text-sm text-vizme-greyblue mb-1 max-w-md">
            Hubo un error inesperado. Intenta recargar la página.
          </p>
          <p className="text-[10px] text-vizme-greyblue/50 mb-6 font-mono max-w-sm truncate">
            {this.state.error?.message}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-vizme-red px-5 py-2.5 text-sm font-semibold text-white hover:bg-vizme-orange transition-all"
          >
            <RefreshCw size={14} /> Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
