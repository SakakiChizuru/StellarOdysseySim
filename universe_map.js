class UniverseMap {
	constructor(canvasId) {
		this.canvas = document.getElementById(canvasId);
		this.ctx = this.canvas.getContext("2d");
		this.systems = [];
		this.hoveredSystem = null;
		this.scale = 1;
		this.offsetX = 0;
		this.offsetY = 0;
		this.isDragging = false;
		this.lastX = 0;
		this.lastY = 0;
		this.zoomLevel = 1;
		this.zoomCenterX = 0;
		this.zoomCenterY = 0;
		this.playerPosition = null;
		this.pulseAnimation = null;
		this.pulsePhase = 0;
		this.ripples = [];
		this.journalData = null;
		this.hoveredJourneyPoint = null;

		// Load checkbox states from localStorage
		this.showPublicSystems =
			localStorage.getItem("showPublicSystems") === "true";
		this.showCurrentPosition =
			localStorage.getItem("showCurrentPosition") === "true";
		this.showPlayerJourney =
			localStorage.getItem("showPlayerJourney") === "true";

		// Set initial checkbox states
		document.getElementById("show_public_systems").checked =
			this.showPublicSystems;
		document.getElementById("show_current_position").checked =
			this.showCurrentPosition;
		document.getElementById("show_player_journey").checked =
			this.showPlayerJourney;

		// Add checkbox event listeners
		document
			.getElementById("show_public_systems")
			.addEventListener("change", (e) => {
				this.showPublicSystems = e.target.checked;
				localStorage.setItem(
					"showPublicSystems",
					this.showPublicSystems
				);
				this.draw();
			});

		document
			.getElementById("show_current_position")
			.addEventListener("change", (e) => {
				this.showCurrentPosition = e.target.checked;
				localStorage.setItem(
					"showCurrentPosition",
					this.showCurrentPosition
				);
				if (this.showCurrentPosition && this.playerPosition) {
					this.startPulseAnimation();
				} else {
					if (this.pulseAnimation) {
						cancelAnimationFrame(this.pulseAnimation);
						this.pulseAnimation = null;
					}
					this.ripples = [];
					this.draw();
				}
			});

		document
			.getElementById("show_player_journey")
			.addEventListener("change", (e) => {
				this.showPlayerJourney = e.target.checked;
				localStorage.setItem(
					"showPlayerJourney",
					this.showPlayerJourney
				);
				this.draw();
			});

		// Set canvas size
		this.resizeCanvas();
		window.addEventListener("resize", () => this.resizeCanvas());

		// Add event listeners
		this.canvas.addEventListener("mousemove", (e) =>
			this.handleMouseMove(e)
		);
		this.canvas.addEventListener("mousedown", (e) =>
			this.handleMouseDown(e)
		);
		this.canvas.addEventListener("mouseup", () => this.handleMouseUp());
		this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));
	}

	resizeCanvas() {
		// Make canvas responsive while maintaining aspect ratio
		const container = this.canvas.parentElement;
		const containerWidth = container.clientWidth;
		const containerHeight = container.clientHeight;

		// Use the height as base and make width 15% larger
		const height = Math.min(containerWidth / 1.18, containerHeight) * 1.18;
		const width = height * 1.18;

		// Set width and height
		this.canvas.width = width;
		this.canvas.height = height;

		// Ensure the canvas maintains its shape
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;

		this.draw();
	}

	loadSystems(data) {
		this.systems = data.systems;
		// Update the systems count text
		const systemsCountElement = document.getElementById("systemsCount");
		if (systemsCountElement) {
			systemsCountElement.textContent = `目前有 ${this.systems.length} 个公开的星系`;
		}
		this.draw();
	}

	setPlayerPosition(position) {
		this.playerPosition = position;
		if (this.pulseAnimation) {
			cancelAnimationFrame(this.pulseAnimation);
		}
		this.ripples = [];
		this.startPulseAnimation();
	}

	setJournalData(journalData) {
		this.journalData = journalData;
		// Calculate and display total distance traveled
		const distanceElement = document.getElementById("totalDistance");
		if (
			distanceElement &&
			this.journalData &&
			this.journalData.fullJournal.length > 0
		) {
			let totalDistance = 0;
			const journal = this.journalData.fullJournal;

			// Calculate distance between consecutive non-starter systems
			for (let i = 1; i < journal.length; i++) {
				const prev = journal[i - 1];
				const curr = journal[i];

				// Only add distance if neither system is a starter
				if (!prev.starter && !curr.starter) {
					const dx = curr.coordinate_x - prev.coordinate_x;
					const dy = curr.coordinate_y - prev.coordinate_y;
					totalDistance += 10 * Math.sqrt(dx * dx + dy * dy);
				}
			}

			distanceElement.textContent = `你当前已旅行 ${totalDistance.toFixed(
				2
			)} 光年`;
		} else if (distanceElement) {
			distanceElement.textContent = "你当前已旅行0光年";
		}
		this.draw();
	}

	startPulseAnimation() {
		const animate = () => {
			// Add new ripple every 0.3 seconds (was 0.2)
			if (this.pulsePhase % (Math.PI * 2) < 0.1) {
				this.ripples.push({
					size: 5, // Start with a small circle
					opacity: 1,
					startTime: Date.now(),
				});
			}
			this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2); // Slower phase change for less frequent ripples

			// Update existing ripples
			const currentTime = Date.now();
			this.ripples = this.ripples.filter((ripple) => {
				const age = currentTime - ripple.startTime;
				const progress = age / 750; // 750ms = 0.75 seconds for full animation (was 500ms)

				if (progress >= 1) return false; // Remove after 0.75 seconds

				ripple.size = 5 + progress * 25; // Expand from 5 to 30
				ripple.opacity = 1 - progress; // Fade out linearly
				return true;
			});

			this.draw();
			this.pulseAnimation = requestAnimationFrame(animate);
		};
		this.pulseAnimation = requestAnimationFrame(animate);
	}

	// Helper function to get color based on date
	getColorFromDate(date) {
		if (!date) return "#FF5252";

		// Convert date string to timestamp
		const timestamp = new Date(date).getTime();

		// Get min and max timestamps from journal data
		const timestamps = this.journalData.fullJournal.map((entry) =>
			new Date(entry.date).getTime()
		);
		const minTimestamp = Math.min(...timestamps);
		const maxTimestamp = Math.max(...timestamps);

		// Normalize timestamp to 0-1 range
		const normalized =
			(timestamp - minTimestamp) / (maxTimestamp - minTimestamp);

		// Use a color gradient from blue (old) to red (new)
		const hue = (1 - normalized) * 240; // 240 (blue) to 0 (red)
		return `hsl(${hue}, 100%, 50%)`;
	}

	draw() {
		const ctx = this.ctx;
		const width = this.canvas.width;
		const height = this.canvas.height;
		const padding = {
			left: 40,
			right: 140,
			top: 25,
			bottom: 25,
		};
		const graphWidth = width - padding.left - padding.right;
		const graphHeight = height - padding.top - padding.bottom;

		// Clear canvas
		ctx.fillStyle = "#181c24";
		ctx.fillRect(0, 0, width, height);

		// Set text style for coordinates
		ctx.font = "12px Arial";
		ctx.fillStyle = "#e6eaf3";

		// Draw grid and coordinates
		ctx.strokeStyle = "#2c3242";
		ctx.lineWidth = 1;

		// Calculate visible range based on zoom and offset
		const visibleRange = 2000 / this.zoomLevel;
		const startX = Math.max(0, Math.floor(this.offsetX / 250) * 250);
		const endX = Math.min(
			2000,
			Math.ceil((this.offsetX + visibleRange) / 250) * 250
		);
		const startY = Math.max(0, Math.floor(this.offsetY / 250) * 250);
		const endY = Math.min(
			2000,
			Math.ceil((this.offsetY + visibleRange) / 250) * 250
		);

		// Function to convert coordinate to pixel position
		const toPixelX = (x) =>
			padding.left +
			((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
		const toPixelY = (y) =>
			height -
			padding.bottom -
			((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

		// Draw the four edges of the graph first
		ctx.beginPath();
		// Left edge
		ctx.moveTo(padding.left, padding.top);
		ctx.lineTo(padding.left, height - padding.bottom);
		// Bottom edge
		ctx.lineTo(width - padding.right, height - padding.bottom);
		// Right edge
		ctx.lineTo(width - padding.right, padding.top);
		// Top edge
		ctx.lineTo(padding.left, padding.top);
		ctx.stroke();

		// Draw vertical lines and x-coordinates
		for (let i = startX; i <= endX; i += 250) {
			const x = toPixelX(i);

			// Only draw grid lines within the graph boundaries
			if (x >= padding.left && x <= width - padding.right) {
				// Draw grid line
				ctx.beginPath();
				ctx.moveTo(x, padding.top);
				ctx.lineTo(x, height - padding.bottom);
				ctx.stroke();
			}

			// Draw bottom tick and label
			ctx.beginPath();
			ctx.moveTo(x, height - padding.bottom);
			ctx.lineTo(x, height - padding.bottom + 5);
			ctx.stroke();
			ctx.textAlign = "center";
			ctx.fillText(i.toString(), x, height - padding.bottom + 20);

			// Draw top tick and label
			ctx.beginPath();
			ctx.moveTo(x, padding.top);
			ctx.lineTo(x, padding.top - 5);
			ctx.stroke();
			ctx.fillText(i.toString(), x, padding.top - 10);
		}

		// Draw horizontal lines and y-coordinates
		for (let i = startY; i <= endY; i += 250) {
			const y = toPixelY(i);

			// Only draw grid lines within the graph boundaries
			if (y >= padding.top && y <= height - padding.bottom) {
				// Draw grid line
				ctx.beginPath();
				ctx.moveTo(padding.left, y);
				ctx.lineTo(width - padding.right, y);
				ctx.stroke();
			}

			// Draw left tick and label
			ctx.beginPath();
			ctx.moveTo(padding.left, y);
			ctx.lineTo(padding.left - 5, y);
			ctx.stroke();
			ctx.textAlign = "right";
			ctx.fillText(i.toString(), padding.left - 10, y + 4);

			// Draw right tick and label
			ctx.beginPath();
			ctx.moveTo(width - padding.right, y);
			ctx.lineTo(width - padding.right + 5, y);
			ctx.stroke();
			ctx.textAlign = "left";
			ctx.fillText(i.toString(), width - padding.right + 10, y + 4);
		}

		// Draw colorbar if showing journey
		if (
			this.showPlayerJourney &&
			this.journalData &&
			this.journalData.fullJournal.length > 0
		) {
			const colorbarWidth = 20;
			const colorbarHeight = graphHeight;
			const colorbarX = width - padding.right + 50;
			const colorbarY = padding.top;

			// Draw colorbar background
			ctx.fillStyle = "#23283a";
			ctx.fillRect(
				colorbarX - 5,
				colorbarY - 5,
				colorbarWidth + 10,
				colorbarHeight + 10
			);

			// Create gradient with multiple color stops to match the HSL interpolation
			const gradient = ctx.createLinearGradient(
				0,
				colorbarY + colorbarHeight,
				0,
				colorbarY
			);
			gradient.addColorStop(0, "hsl(240, 100%, 50%)"); // Blue (old)
			gradient.addColorStop(0.5, "hsl(120, 100%, 50%)"); // Green (middle)
			gradient.addColorStop(1, "hsl(0, 100%, 50%)"); // Red (new)

			ctx.fillStyle = gradient;
			ctx.fillRect(colorbarX, colorbarY, colorbarWidth, colorbarHeight);

			// Get min and max dates
			const dates = this.journalData.fullJournal.map(
				(entry) => new Date(entry.date)
			);
			const minDate = new Date(Math.min(...dates));
			const maxDate = new Date(Math.max(...dates));

			// Format dates
			const formatDate = (date) => {
				return date.toLocaleDateString("en-US", {
					month: "short",
					day: "numeric",
					year: "numeric",
				});
			};

			// Draw ticks and labels (oldest at bottom, newest at top)
			const numTicks = 5;
			ctx.fillStyle = "#e6eaf3";
			ctx.textAlign = "left";
			ctx.font = "10px Arial";

			for (let i = 0; i <= numTicks; i++) {
				const y = colorbarY + (colorbarHeight * i) / numTicks;
				const date = new Date(
					minDate.getTime() +
						(maxDate.getTime() - minDate.getTime()) *
							(1 - i / numTicks)
				);

				// Draw tick line
				ctx.beginPath();
				ctx.moveTo(colorbarX + colorbarWidth + 2, y);
				ctx.lineTo(colorbarX + colorbarWidth + 5, y);
				ctx.strokeStyle = "#e6eaf3";
				ctx.stroke();

				// Draw date label
				ctx.fillText(
					formatDate(date),
					colorbarX + colorbarWidth + 8,
					y + 3
				);
			}
		}

		// Draw player position if available and showCurrentPosition is true
		if (this.showCurrentPosition && this.playerPosition) {
			const x = toPixelX(this.playerPosition.coordinate_x);
			const y = toPixelY(this.playerPosition.coordinate_y);

			// Only draw if within visible area and graph boundaries
			if (
				x >= padding.left &&
				x <= width - padding.right &&
				y >= padding.top &&
				y <= height - padding.bottom
			) {
				// Draw expanding ripples
				this.ripples.forEach((ripple) => {
					ctx.beginPath();
					ctx.arc(x, y, ripple.size, 0, Math.PI * 2);
					ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.opacity})`;
					ctx.lineWidth = 2;
					ctx.stroke();
				});
			}
		}

		// Draw systems if showPublicSystems is true
		if (this.showPublicSystems) {
			this.systems.forEach((system, index) => {
				const x = toPixelX(system.coordinate_x);
				const y = toPixelY(system.coordinate_y);

				// Only draw systems that are within the visible area and graph boundaries
				if (
					x >= padding.left &&
					x <= width - padding.right &&
					y >= padding.top &&
					y <= height - padding.bottom
				) {
					// Set color based on whether it's a starter system (first 9) or not
					ctx.fillStyle = index < 9 ? "#4CAF50" : "#FF5252";

					// Draw system point as a square (2x2 pixels)
					const size = this.hoveredSystem === system ? 7 : 5;
					ctx.fillRect(x - size / 2, y - size / 2, size, size);

					// Draw system name if hovered
					if (this.hoveredSystem === system) {
						ctx.font = "14px Arial";
						ctx.fillStyle = "#e6eaf3";
						ctx.textAlign = "center";
						ctx.fillText(system.name, x, y - 10);
					}
				}
			});
		}

		// Draw player journey if enabled (moved to the end to ensure it's drawn on top)
		if (
			this.showPlayerJourney &&
			this.journalData &&
			this.journalData.fullJournal.length > 0
		) {
			// Create a map to store the latest visit date for each system
			const systemVisits = new Map();
			this.journalData.fullJournal.forEach((entry) => {
				systemVisits.set(
					entry.coordinate_x + "," + entry.coordinate_y,
					entry.date
				);
			});

			// Draw journey points
			systemVisits.forEach((date, coords) => {
				const [x, y] = coords.split(",").map(Number);
				const pixelX = toPixelX(x);
				const pixelY = toPixelY(y);

				// Only draw if within visible area and graph boundaries
				if (
					pixelX >= padding.left &&
					pixelX <= width - padding.right &&
					pixelY >= padding.top &&
					pixelY <= height - padding.bottom
				) {
					// Draw journey point
					ctx.fillStyle = this.getColorFromDate(date);
					const isHovered =
						this.hoveredJourneyPoint &&
						this.hoveredJourneyPoint.x === x &&
						this.hoveredJourneyPoint.y === y;
					const size = isHovered ? 7 : 4;
					ctx.beginPath();
					ctx.arc(pixelX, pixelY, size, 0, Math.PI * 2);
					ctx.fill();

					// Draw tooltip for hovered point
					if (isHovered) {
						const visitDate = new Date(date);
						const formattedDate = visitDate.toLocaleString(
							"en-US",
							{
								year: "numeric",
								month: "short",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
								hour12: false,
							}
						);

						// Draw tooltip background
						ctx.font = "12px Arial";
						const textWidth = ctx.measureText(formattedDate).width;
						const tooltipX = pixelX + 10;
						const tooltipY = pixelY - 10;

						ctx.fillStyle = "rgba(35, 40, 58, 0.9)";
						ctx.fillRect(
							tooltipX - 5,
							tooltipY - 20,
							textWidth + 10,
							25
						);

						// Draw tooltip text
						ctx.fillStyle = "#e6eaf3";
						ctx.textAlign = "left";
						ctx.fillText(formattedDate, tooltipX, tooltipY);
					}
				}
			});
		}
	}

	handleMouseMove(e) {
		const rect = this.canvas.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const padding = {
			left: 40,
			right: 140,
			top: 25,
			bottom: 25,
		};
		const graphWidth = this.canvas.width - padding.left - padding.right;
		const graphHeight = this.canvas.height - padding.top - padding.bottom;

		if (this.isDragging) {
			// Calculate the movement in coordinate space
			const dx =
				((x - this.lastX) / (graphWidth * this.zoomLevel)) * 2000;
			const dy =
				((y - this.lastY) / (graphHeight * this.zoomLevel)) * 2000;

			// Update offset (negative because we want to move the map in the opposite direction of the drag)
			this.offsetX -= dx;
			this.offsetY += dy; // Positive because y-axis is inverted

			// Ensure the offset stays within bounds
			const maxOffset = 2000 * (1 - 1 / this.zoomLevel);
			this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
			this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));

			this.lastX = x;
			this.lastY = y;
			this.draw();
			return;
		}

		// Check if mouse is over any journey point first
		if (
			this.showPlayerJourney &&
			this.journalData &&
			this.journalData.fullJournal.length > 0
		) {
			let foundJourneyPoint = false;
			const systemVisits = new Map();
			this.journalData.fullJournal.forEach((entry) => {
				systemVisits.set(
					entry.coordinate_x + "," + entry.coordinate_y,
					entry.date
				);
			});

			for (const [coords, date] of systemVisits) {
				const [coordX, coordY] = coords.split(",").map(Number);
				const pixelX =
					padding.left +
					((coordX - this.offsetX) / 2000) *
						graphWidth *
						this.zoomLevel;
				const pixelY =
					this.canvas.height -
					padding.bottom -
					((coordY - this.offsetY) / 2000) *
						graphHeight *
						this.zoomLevel;

				const distance = Math.sqrt(
					Math.pow(x - pixelX, 2) + Math.pow(y - pixelY, 2)
				);

				if (distance < 10) {
					this.hoveredJourneyPoint = {
						x: coordX,
						y: coordY,
						date: date,
					};
					this.hoveredSystem = null;
					foundJourneyPoint = true;
					break;
				}
			}

			if (!foundJourneyPoint) {
				this.hoveredJourneyPoint = null;
			}
		}

		// If not hovering over a journey point, check for systems
		if (!this.hoveredJourneyPoint) {
			let found = false;
			for (const system of this.systems) {
				const systemX =
					padding.left +
					((system.coordinate_x - this.offsetX) / 2000) *
						graphWidth *
						this.zoomLevel;
				const systemY =
					this.canvas.height -
					padding.bottom -
					((system.coordinate_y - this.offsetY) / 2000) *
						graphHeight *
						this.zoomLevel;
				const distance = Math.sqrt(
					Math.pow(x - systemX, 2) + Math.pow(y - systemY, 2)
				);

				if (distance < 10) {
					this.hoveredSystem = system;
					found = true;
					break;
				}
			}

			if (!found) {
				this.hoveredSystem = null;
			}
		}

		this.draw();
	}

	handleMouseDown(e) {
		this.isDragging = true;
		const rect = this.canvas.getBoundingClientRect();
		this.lastX = e.clientX - rect.left;
		this.lastY = e.clientY - rect.top;
	}

	handleMouseUp() {
		this.isDragging = false;
	}

	handleWheel(e) {
		e.preventDefault();
		const rect = this.canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		// Calculate the coordinate under the mouse before zoom
		const padding = {
			left: 40,
			right: 140,
			top: 25,
			bottom: 25,
		};
		const graphWidth = this.canvas.width - padding.left - padding.right;
		const graphHeight = this.canvas.height - padding.top - padding.bottom;

		const coordX =
			this.offsetX +
			((mouseX - padding.left) / (graphWidth * this.zoomLevel)) * 2000;
		const coordY =
			this.offsetY +
			((this.canvas.height - mouseY - padding.bottom) /
				(graphHeight * this.zoomLevel)) *
				2000;

		// Update zoom level
		const delta = e.deltaY;
		const zoomFactor = delta > 0 ? 0.9 : 1.1;
		const newZoomLevel = this.zoomLevel * zoomFactor;

		// Prevent zooming out beyond initial view
		if (newZoomLevel < 1) {
			this.zoomLevel = 1;
			this.offsetX = 0;
			this.offsetY = 0;
			this.draw();
			return;
		}

		// Limit maximum zoom (increased by 100%)
		this.zoomLevel = Math.min(100, newZoomLevel);

		// Calculate new offset to keep the point under the mouse in the same position
		const newCoordX =
			this.offsetX +
			((mouseX - padding.left) / (graphWidth * this.zoomLevel)) * 2000;
		const newCoordY =
			this.offsetY +
			((this.canvas.height - mouseY - padding.bottom) /
				(graphHeight * this.zoomLevel)) *
				2000;

		this.offsetX += coordX - newCoordX;
		this.offsetY += coordY - newCoordY;

		// Ensure the offset stays within bounds
		const maxOffset = 2000 * (1 - 1 / this.zoomLevel);
		this.offsetX = Math.max(0, Math.min(maxOffset, this.offsetX));
		this.offsetY = Math.max(0, Math.min(maxOffset, this.offsetY));

		this.draw();
	}
}

// Initialize the map when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	let universeMap = null;

	// Function to initialize the map
	function initializeMap() {
		if (!universeMap) {
			universeMap = new UniverseMap("universeMap");
		}
		universeMap.draw();
	}

	// Add button to load systems
	const loadButton = document.getElementById("loadSystemsBtn");
	const apiKeyInput = document.getElementById("systems_api_key");

	// Load saved API key from localStorage
	if (apiKeyInput) {
		const savedApiKey = localStorage.getItem("systems_api_key");
		if (savedApiKey) {
			apiKeyInput.value = savedApiKey;
		}
	}

	if (loadButton && apiKeyInput) {
		loadButton.addEventListener("click", async () => {
			const apiKey = apiKeyInput.value.trim();
			if (!apiKey) {
				alert("请输入你的API key");
				return;
			}

			// Save API key to localStorage
			localStorage.setItem("systems_api_key", apiKey);

			try {
				loadButton.disabled = true;
				loadButton.textContent = "载入中...";

				// Load systems
				const systemsResponse = await fetch(
					"https://api.stellarodyssey.app/api/public/systems",
					{
						headers: {
							Accept: "application/json",
							"sodyssey-api-key": apiKey,
						},
					}
				);

				if (!systemsResponse.ok) {
					throw new Error(
						`Server responded with status ${systemsResponse.status}`
					);
				}

				const systemsData = await systemsResponse.json();
				universeMap.loadSystems(systemsData);

				// Add a 1 second delay between requests
				await new Promise((resolve) => setTimeout(resolve, 1000));

				// Load journal
				const journalResponse = await fetch(
					"https://api.stellarodyssey.app/api/public/journal",
					{
						headers: {
							Accept: "application/json",
							"sodyssey-api-key": apiKey,
						},
					}
				);

				if (!journalResponse.ok) {
					throw new Error(
						`Server responded with status ${journalResponse.status}`
					);
				}

				const journalData = await journalResponse.json();
				if (
					journalData.fullJournal &&
					journalData.fullJournal.length > 0
				) {
					universeMap.setPlayerPosition(journalData.fullJournal[0]);
					universeMap.setJournalData(journalData);
				}

				loadButton.disabled = false;
				loadButton.textContent = "载入星图";
			} catch (error) {
				alert("读取数据失败: " + error.message);
				loadButton.disabled = false;
				loadButton.textContent = "载入星图";
			}
		});
	}

	// Add event listener for tab switching
	const universeMapTab = document.querySelector(
		'.tab[data-tab="universe-map-tab"]'
	);
	if (universeMapTab) {
		universeMapTab.addEventListener("click", () => {
			// Initialize and draw the map when switching to the universe map tab
			initializeMap();
		});
	}

	// Initialize the map immediately if we're on the universe map tab
	if (
		document.getElementById("universe-map-tab").classList.contains("active")
	) {
		initializeMap();
	}
});
