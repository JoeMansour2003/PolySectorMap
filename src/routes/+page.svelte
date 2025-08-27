<script lang="ts">
	import { marked } from 'marked';
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
	import { onMount, onDestroy } from 'svelte';
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
	let addDeviceOpen = false;
	let addDeviceLoading = false;
	let loadingMessage = 'Saving device and starting analysis...';
	let messageTimers: ReturnType<typeof setTimeout>[] = [];

	// Reference to the dialog element
	let addDeviceDialog: HTMLDialogElement | null = null;

	// Open/close the native <dialog> imperatively when state changes
	$: {
		if (addDeviceDialog) {
			if (addDeviceOpen && !addDeviceDialog.open) addDeviceDialog.showModal();
			if (!addDeviceOpen && addDeviceDialog.open) addDeviceDialog.close();
		}
	}

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

	function startLoadingMessages() {
		clearMessageTimers();
		loadingMessage = 'Saving device and starting analysis...';
		messageTimers.push(
			setTimeout(() => (loadingMessage = 'Contacting vulnerability databases...'), 3000)
		);
		messageTimers.push(
			setTimeout(() => (loadingMessage = 'Generating threat insights with AI...'), 8000)
		);
		messageTimers.push(
			setTimeout(() => (loadingMessage = 'This is taking longer than expected...'), 15000)
		);
		messageTimers.push(
			setTimeout(() => (loadingMessage = 'Still working... almost there.'), 30000)
		);
	}
	function clearMessageTimers() {
		messageTimers.forEach(clearTimeout);
		messageTimers = [];
	}
	onDestroy(clearMessageTimers);

	async function addNewDevice() {
		addDeviceLoading = true;
		startLoadingMessages();
		const payload = {
			name: newDevice.name.trim(),
			description: newDevice.description.trim(),
			IP_Address: newDevice.IP_Address || null,
			Mac_Address: newDevice.Mac_Address || null,
			sector: newDevice.sector
		};
		try {
			const res = await fetch('http://127.0.0.1:8000/api/iot-devices/', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				console.error('Failed to create device:', await res.text());
				return; // keep modal open so user can retry/close
			}
			const created: IoTDevice = await res.json();
			IoTDevices_UI = [...IoTDevices_UI, { ...created, isActive: false, isHovering: false }].sort(
				(a, b) => a.name.localeCompare(b.name)
			);
			newDevice = { name: '', IP_Address: '', Mac_Address: '', description: '', sector: [] };
			addDeviceOpen = false;
		} catch (e) {
			console.error('Error creating device:', e);
		} finally {
			clearMessageTimers();
			addDeviceLoading = false;
		}
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
		class="bg-base-200 flex h-full w-64 flex-col overflow-y-auto overflow-x-hidden rounded-bl-lg rounded-tl-lg p-4"
	>
		<h2 class="mb-4 text-xl font-bold">IoT Devices</h2>
		<div class="mb-4 flex items-center">
			<input type="text" placeholder="Search" class="input input-bordered hidden w-full" />
			<button class="btn btn-primary ml-2 hidden"><Search />Search</button>
		</div>
		<div class="mb-4 flex flex-col gap-2">
			<button class="btn btn-block btn-accent hidden -translate-y-0.5"><Network />Scan Now</button>
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
			<ul class="menu bg-base-200 rounded-box grid h-full w-full overflow-y-auto overflow-x-hidden">
				<!-- overflow-x-hidden -->

				{#each IoTDevices_UI as device, i}
					<li
						class="group-[.hover-delete]:text-error group w-full cursor-pointer"
						class:hover-delete={device.isHovering}
						class:bg-primary-focus={device.isActive}
						on:click={() => setActiveDevice(i)}
					>
						<div class="group-[.hover-delete]:text-error grid-cols-2 p-0">
							<div class="group-[.hover-delete]:text-error pb-2 pl-2 pt-2">
								<MonitorSmartphone />
								{device.name}
							</div>
							<div class="flex justify-end pb-2 pr-2 pt-2">
								<a
									class="text-base-content/50 group-[.hover-delete]:text-error-content absolute right-3 top-2 text-xs"
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
								class="text-base-content/50 group-[.hover-delete]:text-error-content absolute bottom-0.5 right-2 flex justify-end text-xs"
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
			<button class="btn btn-secondary w-full" on:click={() => (addDeviceOpen = true)}>
				<Plus />Add New IoT Device
			</button>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="bg-base-300 h-full flex-1 overflow-y-auto rounded-br-lg rounded-tr-lg p-4">
		{#if selectedDevice}
			<h2 class="mb-4 text-5xl font-bold">{selectedDevice.name}</h2>

			<div class="card bg-base-100 mb-4 shadow-xl">
				<div class="card-body">
					<h2 class="card-title">Device Information</h2>
					<div class="grid grid-cols-2 gap-2">
						<div class="font-semibold">Description:</div>
						<div>{selectedDevice.description || 'No description available'}</div>
						<div class="hidden font-semibold">IP Address:</div>
						<div class="hidden">{selectedDevice.IP_Address || 'Not available'}</div>
						<div class="hidden font-semibold">MAC Address:</div>
						<div class="hidden">{selectedDevice.Mac_Address || 'Not available'}</div>
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
						<div class="collapse-title {getThreatLevelClass(threat.threat_Level)}">
							<b>{threat.attack_Name}</b> <i>({threat.threat_Level})</i>
						</div>
						<div class="collapse-content text-sm">
							<p class="mb-2">{threat.description || 'No description available'}</p>

							{#each threat.threat_details as threatDetail}
								<div class="bg-base-200 border-base-300 collapse-arrow collapse border">
									<input type="checkbox" />
									<div class="collapse-title font-semibold">
										{threatDetail.threat_info_category.topic}
										<i class="text-base-content/50">{threatDetail.ai_summary}</i>
									</div>
									<!-- <textarea class="collapse-content" bind:value={threatDetail.details}/> -->
									<!-- <div class="collapse-content">{@html marked(threatDetail.details)}</div> -->
									<div class="collapse-content prose prose-sm max-w-none">
										{@html marked(threatDetail.details)}
									</div>
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
<dialog
	class="modal"
	bind:this={addDeviceDialog}
	on:close={() => (addDeviceOpen = false)}
	on:cancel={(e) => {
		e.preventDefault(); // keep modal modal; then sync state
		addDeviceOpen = false;
	}}
>
	<div class="modal-box">
		<button
			class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
			on:click={() => !addDeviceLoading && (addDeviceOpen = false)}
			aria-label="Close">✕</button
		>
		<h3 class="text-lg font-bold">Add New IoT Device</h3>

		<form class="space-y-4 py-4" on:submit|preventDefault={addNewDevice}>
			<div class="form-control">
				<label class="label">
					<span class="label-text">Device Name</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.name}
					placeholder="Enter device name"
					class="input input-bordered w-full"
					required
					disabled={addDeviceLoading}
				/>
			</div>
			<div class="form-control">
				<label class="label">
					<span class="label-text">Description</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.description}
					class="input input-bordered w-full"
					placeholder="Device description"
					required
					disabled={addDeviceLoading}
				/>
			</div>

			<div class="form-control hidden">
				<label class="label">
					<span class="label-text">IP Address</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.IP_Address}
					placeholder="192.168.1.1"
					class="input input-bordered w-full"
				/>
			</div>

			<div class="form-control hidden">
				<label class="label">
					<span class="label-text">MAC Address</span>
				</label>
				<input
					type="text"
					bind:value={newDevice.Mac_Address}
					placeholder="00:00:00:00:00:00"
					class="input input-bordered w-full"
				/>
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
								name="sectors"
								value={sector.id}
								on:change={(e) => handleSectorChange(e, sector.id)}
								required={newDevice.sector.length === 0}
								title="Select at least one sector"
								disabled={addDeviceLoading}
							/>
							<span class="label-text ml-2">{sector.name}</span>
						</label>
					{/each}
				</div>
			</div>

			<div class="modal-action">
				<button
					class="btn btn-ghost"
					type="button"
					on:click={() => (addDeviceOpen = false)}
					disabled={addDeviceLoading}
				>
					Cancel
				</button>
				<button type="submit" class="btn btn-primary" disabled={addDeviceLoading}>
					{#if addDeviceLoading}
						<span class="loading loading-spinner loading-sm mr-2"></span>
					{/if}
					Save Device
				</button>
			</div>
		</form>
	</div>
</dialog>

<!-- Global loading overlay -->
{#if addDeviceLoading}
	<div class="bg-base-300/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
		<div class="text-center">
			<span class="loading loading-spinner text-primary" style="transform: scale(3);"></span>
			<div class="mt-6 text-xl font-semibold" aria-live="polite">{loadingMessage}</div>
			<div class="text-base-content/70 mt-1">This may take a minute.</div>
		</div>
	</div>
{/if}
