/**
 * Represents a sector for IoT devices
 * Maps to the Sector model in Django
 */
export interface Sector {
	id: number;
	name: string;
	description: string | null;
}

/**
 * Represents an IoT device
 * Maps to the Iot_Device model in Django
 */
export interface IoTDevice {
	id: number;
	name: string;
	description: string | null;
	IP_Address: string | null;
	Mac_Address: string | null;
	sector: number[]; // Array of Sector IDs
}

/**
 * Threat level types
 */
export type ThreatLevel = 'Low' | 'Medium' | 'High' | 'Critical';

/**
 * Represents a threat information category
 * Maps to the Threat_Info_Category model in Django
 */
export interface ThreatInfoCategory {
	id: number;
	topic: string | null;
	description: string | null;
}

/**
 * Represents details about a specific threat
 * Maps to the Threat_Detail model in Django
 */
export interface ThreatDetail {
	id: number;
	threat_info_category: ThreatInfoCategory; // Changed to use the full object
	ai_summary: string | null;
	details: string | null;
}

/**
 * Represents a security threat
 * Maps to the Threat model in Django
 */
export interface Threat {
	id: number;
	threat_Level: ThreatLevel | null;
	attack_Name: string | null;
	description: string | null;
	devices: number[]; // Array of IoTDevice IDs
	threat_details: ThreatDetail[]; // Changed from Threat_Detail to match backend
}
