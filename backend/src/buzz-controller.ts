import HID from 'node-hid';
import { EventEmitter } from 'events';

// Buzz Controller Constants
// The PS2 Buzz controllers appear as a Logitech device with 20 buttons
const BUZZ_VENDOR_ID = 0x054c; // Sony
const BUZZ_PRODUCT_ID_PS2 = 0x1000; // PS2 Buzz Controller
const BUZZ_PRODUCT_ID_PS3 = 0x0002; // PS3 Buzz Controller (alternative)

// Logitech manufactured these for Sony
const LOGITECH_VENDOR_ID = 0x054c;

export interface BuzzButton {
  player: number; // 1-4
  button: 'red' | 'yellow' | 'green' | 'orange' | 'blue';
}

export interface BuzzEvent {
  type: 'press' | 'release';
  player: number;
  button: BuzzButton['button'];
  timestamp: number;
}

export class BuzzController extends EventEmitter {
  private device: HID.HID | null = null;
  private previousState: number[] = [];
  private isConnected: boolean = false;
  private reconnectInterval: NodeJS.Timeout | null = null;

  // Button mapping for PS2 Buzz Controller
  // Buttons are laid out: Red, Yellow, Green, Orange, Blue for each player
  // Player 1: buttons 0-4, Player 2: buttons 5-9, etc.
  private readonly buttonNames: BuzzButton['button'][] = ['red', 'yellow', 'green', 'orange', 'blue'];

  constructor() {
    super();
    this.startConnectionMonitor();
  }

  private startConnectionMonitor(): void {
    this.tryConnect();

    // Keep trying to connect every 2 seconds if disconnected
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnected) {
        this.tryConnect();
      }
    }, 2000);
  }

  private tryConnect(): void {
    try {
      const devices = HID.devices();

      // Find Buzz controller - look for devices with 20+ buttons or known VID/PID
      const buzzDevice = devices.find(d => {
        // Check for known Buzz controller identifiers
        if (d.vendorId === BUZZ_VENDOR_ID || d.vendorId === LOGITECH_VENDOR_ID) {
          const productName = (d.product || '').toLowerCase();
          if (productName.includes('buzz')) {
            return true;
          }
        }
        // Also check for generic game controller with many buttons
        const productName = (d.product || '').toLowerCase();
        if (productName.includes('buzz') || productName.includes('logitech')) {
          return true;
        }
        return false;
      });

      if (buzzDevice && buzzDevice.path) {
        console.log('Found Buzz Controller:', buzzDevice.product);
        console.log('  Vendor ID:', buzzDevice.vendorId?.toString(16));
        console.log('  Product ID:', buzzDevice.productId?.toString(16));

        this.device = new HID.HID(buzzDevice.path);
        this.isConnected = true;

        this.device.on('data', (data: Buffer) => this.handleData(data));
        this.device.on('error', (err: Error) => {
          console.error('Buzz Controller error:', err.message);
          this.disconnect();
        });

        this.emit('connected');
        console.log('Buzz Controller connected!');
      }
    } catch (error) {
      // Silent fail - will retry
    }
  }

  private disconnect(): void {
    if (this.device) {
      try {
        this.device.close();
      } catch (e) {
        // Ignore close errors
      }
      this.device = null;
    }
    this.isConnected = false;
    this.previousState = [];
    this.emit('disconnected');
  }

  private handleData(data: Buffer): void {
    // The Buzz controller sends button states as a bitmask
    // Each report contains the state of all 20 buttons (5 buttons x 4 players)

    const currentState: number[] = Array.from(data);

    // Parse button states from the HID report
    // The exact format depends on the controller, but typically:
    // Bytes 2-4 contain the button states as a bitmask

    if (this.previousState.length === 0) {
      this.previousState = currentState;
      return;
    }

    // Detect button changes
    // Standard HID report format for Buzz controllers:
    // Byte 2: Buttons 0-7
    // Byte 3: Buttons 8-15
    // Byte 4: Buttons 16-19

    for (let byteIndex = 2; byteIndex < Math.min(5, data.length); byteIndex++) {
      const currentByte = data[byteIndex] || 0;
      const previousByte = this.previousState[byteIndex] || 0;

      if (currentByte !== previousByte) {
        for (let bit = 0; bit < 8; bit++) {
          const buttonIndex = (byteIndex - 2) * 8 + bit;
          if (buttonIndex >= 20) break; // Only 20 buttons

          const wasPressed = (previousByte & (1 << bit)) !== 0;
          const isPressed = (currentByte & (1 << bit)) !== 0;

          if (wasPressed !== isPressed) {
            const player = Math.floor(buttonIndex / 5) + 1;
            const buttonType = this.buttonNames[buttonIndex % 5];

            const event: BuzzEvent = {
              type: isPressed ? 'press' : 'release',
              player,
              button: buttonType,
              timestamp: Date.now()
            };

            this.emit('button', event);

            if (isPressed) {
              this.emit('press', event);
            } else {
              this.emit('release', event);
            }
          }
        }
      }
    }

    this.previousState = currentState;
  }

  /**
   * Turn on all lights
   */
  public allLightsOn(): void {
    this.setLights([true, true, true, true]);
  }

  /**
   * Turn off all lights
   */
  public allLightsOff(): void {
    this.setLights([false, false, false, false]);
  }

  // Track current light states for individual light control
  private currentLights: [boolean, boolean, boolean, boolean] = [false, false, false, false];

  /**
   * Set a single player's light without affecting others
   */
  public setLight(player: 1 | 2 | 3 | 4, on: boolean): void {
    this.currentLights[player - 1] = on;
    this.setLights([...this.currentLights]);
  }

  /**
   * Override setLights to track state
   */
  public setLights(lights: [boolean, boolean, boolean, boolean]): void {
    this.currentLights = [...lights];
    this._setLightsInternal(lights);
  }

  private _setLightsInternal(lights: [boolean, boolean, boolean, boolean]): void {
    if (!this.device || !this.isConnected) {
      return;
    }

    try {
      // HID report to control lights
      // Format: [0x00, 0x00, P1, P2, P3, P4, 0x00, 0x00]
      // Where Px is 0xFF for on, 0x00 for off
      const report = Buffer.from([
        0x00, // Report ID
        0x00,
        lights[0] ? 0xff : 0x00,
        lights[1] ? 0xff : 0x00,
        lights[2] ? 0xff : 0x00,
        lights[3] ? 0xff : 0x00,
        0x00,
        0x00
      ]);

      this.device.write(Array.from(report));
    } catch (error) {
      console.error('Failed to set lights:', error);
    }
  }

  /**
   * Blink a specific player's light
   */
  public async blinkLight(player: 1 | 2 | 3 | 4, times: number = 3, intervalMs: number = 200): Promise<void> {
    const lights: [boolean, boolean, boolean, boolean] = [false, false, false, false];

    for (let i = 0; i < times; i++) {
      lights[player - 1] = true;
      this.setLights(lights);
      await this.sleep(intervalMs);
      lights[player - 1] = false;
      this.setLights(lights);
      await this.sleep(intervalMs);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get connection status
   */
  public get connected(): boolean {
    return this.isConnected;
  }

  /**
   * List all HID devices (for debugging)
   */
  public static listDevices(): HID.Device[] {
    return HID.devices();
  }

  /**
   * Cleanup
   */
  public destroy(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    this.disconnect();
  }
}

export default BuzzController;
