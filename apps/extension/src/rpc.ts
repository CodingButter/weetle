/**
 * RPC Bridge - Remote Procedure Call system
 * Dispatches function calls to peers
 */

export interface RPCCall {
  type: 'rpc:call';
  functionName: string;
  args: any[];
  timestamp: number;
}

export interface RPCHandler {
  [key: string]: (...args: any[]) => void;
}

export class RPCBridge {
  private handlers: RPCHandler = {};
  private onSend: ((call: RPCCall) => void) | null = null;

  /**
   * Register a function that can be called remotely
   */
  register(functionName: string, handler: (...args: any[]) => void): void {
    this.handlers[functionName] = handler;
  }

  /**
   * Call a function locally and broadcast to peers
   */
  call(functionName: string, ...args: any[]): void {
    // Execute locally first
    const handler = this.handlers[functionName];
    if (handler) {
      handler(...args);
    } else {
      console.warn(`[RPC] No handler registered for: ${functionName}`);
    }

    // Broadcast to peers
    if (this.onSend) {
      const rpcCall: RPCCall = {
        type: 'rpc:call',
        functionName,
        args,
        timestamp: performance.now(),
      };
      this.onSend(rpcCall);
    }
  }

  /**
   * Handle incoming RPC call from peer
   */
  handleRemote(call: RPCCall): void {
    const handler = this.handlers[call.functionName];
    if (handler) {
      console.log(`[RPC] Executing remote call: ${call.functionName}`, call.args);
      handler(...call.args);
    } else {
      console.warn(`[RPC] No handler for remote call: ${call.functionName}`);
    }
  }

  /**
   * Set callback for sending RPC calls to peers
   */
  setSendCallback(callback: (call: RPCCall) => void): void {
    this.onSend = callback;
  }
}
