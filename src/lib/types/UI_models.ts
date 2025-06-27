import type { Sector, IoTDevice } from './models';

/**
 * Extends the Sector type with UI-specific properties
 */
export interface Sector_UI extends Sector {
	selected: boolean;
}

/**
 * Extends the IoTDevice type with UI-specific properties
 */
export interface IoTDevice_UI extends IoTDevice {
	isActive: boolean;
	isHovering: boolean;
}
