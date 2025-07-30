<script lang="ts">
	import {
		X,
		Search,
		Network,
		MonitorSmartphone,
		Plus,
		CirclePlus,
		Info,
		Theater
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import type {
		Sector,
		IoTDevice,
		ThreatLevel,
		ThreatInfoCategory,
		ThreatDetail,
		Threat
	} from '$lib/types/models';
	import type { Sector_UI, IoTDevice_UI } from '$lib/types/UI_models';

	// Base data from API
	let sectors_data: Sector[] = [];
	let iot_data: IoTDevice[] = [];
	let threatLevels: ThreatLevel[] = [];
	let threatInfoCategories: ThreatInfoCategory[] = [];
	let threatDetails: ThreatDetail[] = [];
	let threats: Threat[] = [];
	let selectedDevice: IoTDevice_UI | null = null;
	let current_sector_filter: number[] = [];

	// UI-enhanced data
	let sector_badges_UI: Sector_UI[] = [];
	let IoTDevices_UI: IoTDevice_UI[] = [];

	// New device form state
	let newDevice = {
		name: '',
		IP_Address: '',
		Mac_Address: '',
		description: '',
		sector: [] as number[]
	};

	function handleSectorChange(event: Event, sectorId: number) {
		const target = event.target as HTMLInputElement;
		if (target.checked) {
			newDevice.sector = [...newDevice.sector, sectorId];
		} else {
			newDevice.sector = newDevice.sector.filter((id) => id !== sectorId);
		}
	}

	function addNewDevice(event: Event) {
		event.preventDefault();

		// Create new device with UI properties
		const device = {
			...newDevice,
			id: Date.now(), // Temporary ID until saved to backend
			isActive: false,
			isHovering: false
		};

		// Add to devices array
		IoTDevices_UI = [...IoTDevices_UI, device];

		// Reset form
		newDevice = {
			name: '',
			IP_Address: '',
			Mac_Address: '',
			description: '',
			sector: []
		};

		// Close modal
		document.getElementById('add_device_modal')?.close();

		// TODO: Send to backend API
		console.log('New device added:', device);
	}

	onMount(async () => {
		const sector_response = await fetch('http://127.0.0.1:8000/api/sectors/');
		sectors_data = await sector_response.json();
		sector_badges_UI = sectors_data.map((sector) => ({ ...sector, selected: false }));
		sector_badges_UI = sector_badges_UI.sort((a, b) => a.name.localeCompare(b.name));
		console.log(sector_badges_UI);

		const iot_response = await fetch('http://127.0.0.1:8000/api/iot-devices/');
		iot_data = await iot_response.json();
		IoTDevices_UI = iot_data.map((device) => ({
			...device, // Spread all properties from the original device
			isActive: false,
			isHovering: false
		}));
		IoTDevices_UI = IoTDevices_UI.sort((a, b) => a.name.localeCompare(b.name));
		console.log(IoTDevices_UI);
	});

	// Toggle badge style when clicked
	async function toggleBadge(index: number) {
		// Toggle the selected state
		sector_badges_UI[index].selected = !sector_badges_UI[index].selected;
		sector_badges_UI = [...sector_badges_UI]; // Trigger reactivity

		// Update the filter array
		if (sector_badges_UI[index].selected) {
			current_sector_filter = [...current_sector_filter, sector_badges_UI[index].id];
		} else {
			current_sector_filter = current_sector_filter.filter(
				(id) => id !== sector_badges_UI[index].id
			);
		}

		// If we have selected sectors, filter devices
		if (current_sector_filter.length > 0) {
			await filterDevicesBySectors();
		} else {
			// If no sectors selected, reset to all devices
			const iot_response = await fetch('http://127.0.0.1:8000/api/iot-devices/');
			const data = await iot_response.json();
			IoTDevices_UI = data.map((device: IoTDevice) => ({
				...device,
				isActive: false,
				isHovering: false
			}));
		}
	}
	async function filterDevicesBySectors() {
		try {
			const response = await fetch('http://127.0.0.1:8000/api/sectors/devices/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sector_ids: current_sector_filter
				})
			});

			if (response.ok) {
				const filtered_devices = await response.json();

				// Update the UI devices while preserving UI state for matching devices
				IoTDevices_UI = filtered_devices.map((newDevice) => {
					// Try to find existing device to keep UI state
					const existingDevice = IoTDevices_UI.find((d) => d.id === newDevice.id);
					if (existingDevice) {
						return {
							...newDevice,
							isActive: existingDevice.isActive,
							isHovering: existingDevice.isHovering
						};
					}
					return {
						...newDevice,
						isActive: false,
						isHovering: false
					};
				});

				// Reset selected device if it's no longer in the filtered list
				if (selectedDevice && !IoTDevices_UI.some((d) => d.id === selectedDevice.id)) {
					selectedDevice = null;
					threats = [];
				}
			} else {
				console.error('Failed to filter devices by sectors:', await response.text());
			}
		} catch (error) {
			console.error('Error filtering devices by sectors:', error);
		}
	}
	async function setActiveDevice(index: number) {
		// Update active state for all devices
		IoTDevices_UI = IoTDevices_UI.map((device, i) => ({
			...device,
			isActive: i === index
		}));

		// Store the selected device
		selectedDevice = IoTDevices_UI[index];

		// Fetch threats for the selected device
		if (selectedDevice) {
			try {
				const threats_response = await fetch(
					`http://127.0.0.1:8000/api/iot-devices/${selectedDevice.id}/threats/`
				);
				if (threats_response.ok) {
					threats = await threats_response.json();
					console.log('Threats for selected device:', threats);
				} else {
					console.error('Failed to fetch threats:', await threats_response.text());
					threats = [];
				}
			} catch (error) {
				console.error('Error fetching threats:', error);
				threats = [];
			}
		}
	}
	function deleteDevice(index: number) {
		// Handle clearing the selectedDevice if it's being deleted
		if (selectedDevice && selectedDevice.id === IoTDevices_UI[index].id) {
			selectedDevice = null;
		}

		IoTDevices_UI = IoTDevices_UI.filter((_, i) => i !== index);
	}
	function getThreatLevelClass(threatLevel: ThreatLevel | null): string {
    switch (threatLevel) {
        case 'Low':
            return 'bg-success';
        case 'Medium':
            return 'bg-warning';
        case 'High':
            return 'bg-error';
        case 'Critical':
            return 'bg-error text-error-content font-bold';
        default:
            return 'bg-base-200';
    }
}
</script>

<div class="flex h-screen w-full">
	<!-- Sidebar Navigation -->
	<div
		class="bg-base-200 flex h-full w-64 flex-col overflow-x-hidden overflow-y-auto rounded-tl-lg rounded-bl-lg p-4"
	>
		<h2 class="mb-4 text-xl font-bold">IoT Devices</h2>
		<div class="mb-4 flex items-center">
			<input type="text" placeholder="Search" class="input input-bordered w-full" />
			<button class="btn btn-primary ml-2"><Search />Search</button>
		</div>
		<div class="mb-4 flex flex-col gap-2">
			<button class="btn btn-block btn-accent -translate-y-0.5"><Network />Scan Now</button>
			<div class="flex flex-wrap gap-2">
				{#each sector_badges_UI as sector, i (sector.id)}
					<div
						class="badge badge-primary {sector.selected
							? ''
							: 'badge-outline'} tooltip h-auto text-wrap"
						data-tip={sector.description || 'No description'}
						on:click={() => toggleBadge(i)}
					>
						{sector.name}
					</div>
				{/each}
			</div>
			{#if current_sector_filter.length > 0}
				<button
					class="btn btn-sm btn-outline mt-2"
					on:click={async () => {
						// Reset all sector badges
						sector_badges_UI = sector_badges_UI.map((s) => ({ ...s, selected: false }));
						current_sector_filter = [];

						// Reset to all devices
						const iot_response = await fetch('http://127.0.0.1:8000/api/iot-devices/');
						const data = await iot_response.json();
						IoTDevices_UI = data.map((device) => ({
							...device,
							isActive: false,
							isHovering: false
						}));
					}}
				>
					Clear filters ({current_sector_filter.length})
				</button>
			{/if}
		</div>
		<div class="mb-2 flex w-full justify-center text-center">
			{#if IoTDevices_UI.length === 0}
				<label class="text-base-content/50">No devices found</label>
			{/if}
			{#if IoTDevices_UI.length > 0}
				<label class="text-base-content/50">Click to select a device</label>
			{/if}
		</div>
		<div class="flex min-h-[150px] flex-1 flex-col overflow-hidden">
			<ul class="menu bg-base-200 rounded-box grid h-full w-full overflow-x-hidden overflow-y-auto">
				<!-- overflow-x-hidden -->

				{#each IoTDevices_UI as device, i}
					<li
						class="group group-[.hover-delete]:text-error w-full cursor-pointer"
						class:hover-delete={device.isHovering}
						class:bg-primary-focus={device.isActive}
						on:click={() => setActiveDevice(i)}
					>
						<div class="group-[.hover-delete]:text-error grid-cols-2 p-0">
							<div class="group-[.hover-delete]:text-error pt-2 pb-2 pl-2">
								<MonitorSmartphone />
								{device.name}
							</div>
							<div class="flex justify-end pt-2 pr-2 pb-2">
								<a
									class="text-base-content/50 group-[.hover-delete]:text-error-content absolute top-2 right-3 text-xs"
									>{device.IP_Address}</a
								>
								<div
									class="group-[.hover-delete]:text-error cursor-pointer pt-2"
									on:mouseenter={() => {
										device.isHovering = true;
										IoTDevices_UI = [...IoTDevices_UI];
									}}
									on:mouseleave={() => {
										device.isHovering = false;
										IoTDevices_UI = [...IoTDevices_UI];
									}}
									on:click={() => deleteDevice(i)}
								>
									<X class="group-[.hover-delete]:text-error" />
								</div>
							</div>
							<div
								class="text-base-content/50 group-[.hover-delete]:text-error-content absolute right-2 bottom-0.5 flex justify-end text-xs"
							>
								{device.Mac_Address}
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
		<!-- </div> -->
		<div class="mt-4">
			<button
				class="btn btn-secondary w-full"
				on:click={() => document.getElementById('add_device_modal').showModal()}
			>
				<Plus />Add New IoT Device
			</button>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="bg-base-300 h-full flex-1 overflow-y-auto rounded-tr-lg rounded-br-lg p-4">
		{#if selectedDevice}
			<h2 class="mb-4 text-5xl font-bold">{selectedDevice.name}</h2>

			<div class="card bg-base-100 mb-4 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Device Information</h2>
					<div class="grid grid-cols-2 gap-2">
						<div class="font-semibold">Description:</div>
						<div>{selectedDevice.description || 'No description available'}</div>
						<div class="font-semibold">IP Address:</div>
						<div>{selectedDevice.IP_Address || 'Not available'}</div>
						<div class="font-semibold">MAC Address:</div>
						<div>{selectedDevice.Mac_Address || 'Not available'}</div>
						<div class="font-semibold">Sectors:</div>
						<div>
							{#if selectedDevice.sector && selectedDevice.sector.length > 0}
								<div class="flex flex-wrap gap-1">
									{#each selectedDevice.sector as sectorId}
										{#each sectors_data.filter((s) => s.id === sectorId) as matchedSector}
											<div class="badge badge-outline">{matchedSector.name}</div>
										{/each}
									{/each}
								</div>
							{:else}
								No sectors assigned
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Your existing collapse sections -->
			<div class="grid gap-1 md:gap-2">
				{#each threats as threat}
					<div class="bg-base-200 border-base-300 collapse-arrow collapse border">
						<input type="checkbox" />
<div class="collapse-title {getThreatLevelClass(threat.threat_Level)}"><b>{threat.attack_Name}</b> <i>({threat.threat_Level})</i></div>
						<div class="collapse-content text-sm">
							<p class="mb-2">{threat.description || 'No description available'}</p>

							{#each threat.threat_details as threatDetail}
								<div class="bg-base-200 border-base-300 collapse-arrow collapse border">
									<input type="checkbox" />
									<div class="collapse-title font-semibold">
										{threatDetail.threat_info_category.topic}
										<i class="text-base-content/50">{threatDetail.ai_summary}</i>
									</div>
									<div class="collapse-content">{threatDetail.details}</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex h-full flex-col items-center justify-center text-center">
				<MonitorSmartphone size={48} class="text-base-content/30 mb-4" />
				<h2 class="mb-2 text-xl font-bold">No Device Selected</h2>
				<p class="text-base-content/70">
					Select an IoT device from the sidebar to view it's details
				</p>
			</div>
		{/if}
	</div>
</div>

<!-- Add Device Modal -->
<dialog id="add_device_modal" class="modal">
	<div class="modal-box">
		<form method="dialog">
			<button class="btn btn-sm btn-circle btn-ghost absolute top-2 right-2">✕</button>
		</form>
		<h3 class="text-lg font-bold">Add New IoT Device</h3>

		<form class="space-y-4 py-4" on:submit|preventDefault={addNewDevice}>
			<div class="form-control">
				<label class="label">
					<span class="label-text">Device Name</span>
				</label>
				<input
					type="text"
					id="device_name"
					bind:value={newDevice.name}
					placeholder="Enter device name"
					class="input input-bordered w-full"
					required
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">IP Address</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.IP_Address}
					placeholder="192.168.1.1"
					class="input input-bordered w-full"
					required
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">MAC Address</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.Mac_Address}
					placeholder="00:00:00:00:00:00"
					class="input input-bordered w-full"
					required
				/>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Description</span>
				</label>
				<textarea
					bind:value={newDevice.description}
					class="textarea textarea-bordered h-24"
					placeholder="Device description"
				></textarea>
			</div>

			<div class="form-control">
				<label class="label">
					<span class="label-text">Sectors</span>
				</label>
				<div class="flex flex-wrap gap-2">
					{#each sector_badges_UI as sector}
						<label class="label cursor-pointer">
							<input
								type="checkbox"
								class="checkbox checkbox-sm"
								value={sector.id}
								on:change={(e) => handleSectorChange(e, sector.id)}
							/>
							<span class="label-text ml-2">{sector.name}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					on:click={() => document.getElementById('add_device_modal').close()}>Cancel</button
				>
				<button type="submit" class="btn btn-primary">Save Device</button>
			</div>
		</form>
	</div>
</dialog>
