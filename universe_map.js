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

class UniverseMapExtended extends UniverseMap {
	constructor(source) {
		if (source instanceof UniverseMap) {
			super(source.canvas.id);
			Object.assign(this, source);
			Object.setPrototypeOf(this, UniverseMapExtended.prototype);
			this.#rebindEventListeners();
		} else if (typeof source === "string") {
			super(source);
		} else {
			console.error(
				"Invalid argument for UniverseMapExtended constructor"
			);
		}
		this.customMarkers = [];
		this.highlightedSystems = [];
		this.trajectories = [];
		this.trajctoryAnimation = null;
		this.trajectoryHueOffset = null;
		this.hueShiftSpeed = 2;
		this.universeGrid = new UniverseGrid(2000, 2000);
	}

	pushTrajectories(trajectories) {
		this.trajectories = trajectories;
	}

	clearTrajectories() {
		this.trajectories = [];
	}

	#rebindEventListeners() {
		this.canvas.removeEventListener("mousemove", this.handleMouseMove);
		this.canvas.removeEventListener("mousedown", this.handleMouseDown);
		this.canvas.removeEventListener("mouseup", this.handleMouseUp);
		this.canvas.removeEventListener("wheel", this.handleWheel);

		this.canvas.addEventListener("mousemove", (e) =>
			this.handleMouseMove(e)
		);
		this.canvas.addEventListener("mousedown", (e) =>
			this.handleMouseDown(e)
		);
		this.canvas.addEventListener("mouseup", () => this.handleMouseUp());
		this.canvas.addEventListener("wheel", (e) => this.handleWheel(e));

		const rebindCheckbox = (id, prop) => {
			const checkbox = document.getElementById(id);
			checkbox.removeEventListener("change", this[`${prop}Handler`]);

			this[`${prop}Handler`] = (e) => {
				this[prop] = e.target.checked;
				localStorage.setItem(prop, this[prop]);
				this.draw();
			};

			checkbox.addEventListener("change", this[`${prop}Handler`]);
		};

		rebindCheckbox("show_public_systems", "showPublicSystems");
		rebindCheckbox("show_current_position", "showCurrentPosition");
		rebindCheckbox("show_player_journey", "showPlayerJourney");
	}

	#distanceToSegment(px, py, x1, y1, x2, y2) {
		const dx = x2 - x1;
		const dy = y2 - y1;
		if (dx === 0 && dy === 0) {
			return Math.hypot(px - x1, py - y1);
		}
		const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
		const clampT = Math.max(0, Math.min(1, t));
		const closestX = x1 + clampT * dx;
		const closestY = y1 + clampT * dy;
		return Math.hypot(px - closestX, py - closestY);
	}

	handleMouseMove(e) {
		super.handleMouseMove(e); // 保留原基类逻辑

		this.hoveredTrajectory = null; // 默认无悬停

		if (!this.trajectories || this.trajectories.length === 0) return;

		const rect = this.canvas.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		const padding = { left: 40, right: 140, top: 25, bottom: 25 };
		const graphWidth = this.canvas.width - padding.left - padding.right;
		const graphHeight = this.canvas.height - padding.top - padding.bottom;

		const toPixelX = (x) =>
			padding.left +
			((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
		const toPixelY = (y) =>
			this.canvas.height -
			padding.bottom -
			((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

		for (let i = 0; i < this.trajectories.length; i++) {
			const seg = this.trajectories[i];
			const fromX = toPixelX(seg.from.x);
			const fromY = toPixelY(seg.from.y);
			const toX = toPixelX(seg.to.x);
			const toY = toPixelY(seg.to.y);

			const dist = this.#distanceToSegment(
				mouseX,
				mouseY,
				fromX,
				fromY,
				toX,
				toY
			);

			if (dist < 8) {
				// hover 阈值
				this.hoveredTrajectory = { index: i, segment: seg };
				break;
			}
		}

		this.draw();
	}

	startTrajectoryAnimation() {
		if (!this.trajectories || this.trajectories.length === 0) return;

		this.trajectoryProgress = 0;
		this.currentSegmentIndex = 0;
		this.animating = true;
		this.trajectoryHueOffset = 0;

		const animate = () => {
			if (!this.animating) return;

			const speed = 0.02;
			this.trajectoryProgress += speed;

			if (this.trajectoryProgress >= 1) {
				this.trajectoryProgress = 0;
				this.currentSegmentIndex++;

				if (this.currentSegmentIndex >= this.trajectories.length) {
					this.animating = false;
					this.trajctoryAnimation = this.startRainbowAnimation();
					return;
				}
			}

			this.draw();
			this.trajctoryAnimation = requestAnimationFrame(animate);
		};

		this.trajctoryAnimation = requestAnimationFrame(animate);
	}

	drawRainbowTrajectory() {
		if (!this.trajectories || this.trajectories.length === 0) return;

		const segments = 50; // 每条轨迹离散多少段

		const padding = { left: 40, right: 140, top: 25, bottom: 25 };
		const width = this.canvas.width;
		const height = this.canvas.height;
		const graphWidth = width - padding.left - padding.right;
		const graphHeight = height - padding.top - padding.bottom;

		const toPixelX = (x) =>
			padding.left +
			((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
		const toPixelY = (y) =>
			height -
			padding.bottom -
			((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

		for (let i = 0; i < this.trajectories.length; i++) {
			const seg = this.trajectories[i];

			const fromX = toPixelX(seg.from.x);
			const fromY = toPixelY(seg.from.y);
			const toX = toPixelX(seg.to.x);
			const toY = toPixelY(seg.to.y);

			for (let j = 0; j < segments; j++) {
				const t1 = j / segments;
				const t2 = (j + 1) / segments;

				const sx1 = fromX + (toX - fromX) * t1;
				const sy1 = fromY + (toY - fromY) * t1;
				const sx2 = fromX + (toX - fromX) * t2;
				const sy2 = fromY + (toY - fromY) * t2;

				// 核心色相计算
				const hue =
					(this.trajectoryHueOffset + i * 40 + (segments - j) * 10) %
					360;
				//const hue = (this.trajectoryHueOffset + i * 40 + j * 10) % 360;

				this.ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
				this.ctx.lineWidth = 2;
				this.ctx.beginPath();
				this.ctx.moveTo(sx1, sy1);
				this.ctx.lineTo(sx2, sy2);
				this.ctx.stroke();
			}
		}
	}

	startRainbowAnimation() {
		const animateRainbow = () => {
			this.trajectoryHueOffset =
				(this.trajectoryHueOffset + this.hueShiftSpeed) % 360;
			this.draw();
			this.trajctoryAnimation = requestAnimationFrame(animateRainbow);
		};
		requestAnimationFrame(animateRainbow);
	}

	draw() {
		//Quit drawing if Map tab not active.
		if (!document.getElementById("universe-map-tab").classList.contains("active")) return;
        
		super.draw();

		if (!this.trajectories || this.trajectories.length === 0) {
			return;
		}

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

		// 复制基类坐标转换函数逻辑
		const toPixelX = (x) =>
			padding.left +
			((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
		const toPixelY = (y) =>
			height -
			padding.bottom -
			((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

		// 绘制每段轨迹
		if (this.trajectories && this.trajectories.length > 0) {
			for (let i = 0; i < this.trajectories.length; i++) {
				const segment = this.trajectories[i];

				const fromX = toPixelX(segment.from.x);
				const fromY = toPixelY(segment.from.y);
				const toX = toPixelX(segment.to.x);
				const toY = toPixelY(segment.to.y);

				let hue;
				if (this.animating) {
					hue = (i * 40) % 360;
				} else {
					hue = (i * 40 + this.trajectoryHueOffset) % 360;
				}

				ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
				ctx.lineWidth = 2;

				ctx.beginPath();
				ctx.moveTo(fromX, fromY);

				if (this.animating) {
					if (i < this.currentSegmentIndex) {
						ctx.lineTo(toX, toY);
					} else if (i === this.currentSegmentIndex) {
						const progress = this.trajectoryProgress;
						const currentX = fromX + (toX - fromX) * progress;
						const currentY = fromY + (toY - fromY) * progress;
						ctx.lineTo(currentX, currentY);
					}
				} else {
					ctx.lineTo(toX, toY);
				}
				ctx.stroke();
			}
		}
		if (!this.animating) {
			this.drawRainbowTrajectory();
		}

		if (this.hoveredTrajectory) {
			const ctx = this.ctx;
			const seg = this.hoveredTrajectory.segment;
			const index = this.hoveredTrajectory.index;

			const toPixelX = (x) =>
				padding.left +
				((x - this.offsetX) / 2000) * graphWidth * this.zoomLevel;
			const toPixelY = (y) =>
				height -
				padding.bottom -
				((y - this.offsetY) / 2000) * graphHeight * this.zoomLevel;

			const midX = (seg.from.x + seg.to.x) / 2;
			const midY = (seg.from.y + seg.to.y) / 2;

			const px = toPixelX(midX);
			const py = toPixelY(midY);

			const text = `第 ${index + 1} 步, 距离 ${seg.distance.toFixed(
				1
			)} 光年`;

			ctx.font = "12px Arial";
			const textWidth = ctx.measureText(text).width;
			ctx.fillStyle = "rgba(35, 40, 58, 0.9)";
			ctx.fillRect(px - 5, py - 25, textWidth + 10, 20);
			ctx.fillStyle = "#e6eaf3";
			ctx.textAlign = "left";
			ctx.fillText(text, px, py - 10);
		}
	}
}

class CoordinateParser {
	static parse(input) {
		if (typeof input === "object") {
			if (Array.isArray(input)) {
				if (input.length !== 2)
					throw new Error("Array must have two elements.");
				return { x: Number(input[0]), y: Number(input[1]) };
			} else if (input !== null && "x" in input && "y" in input) {
				return { x: Number(input.x), y: Number(input.y) };
			} else if (
				input !== null &&
				"coordinate_x" in input &&
				"coordinate_y" in input
			) {
				return `[${input.coordinate_x},${input.coordinate_y}]`;
			} else {
				throw new Error("Object must contain x and y properties.");
			}
		}

		if (typeof input !== "string") {
			throw new Error("Unsupported input type.");
		}

		// 统一处理字符串
		const normalized = this.#normalizeString(input);
		const match = normalized.match(/(-?\d+(\.\d+)?)[,;\s](-?\d+(\.\d+)?)/);
		if (match) {
			return {
				x: Number(match[1]),
				y: Number(match[3]),
			};
		}

		// 处理 x=100,y=200 格式
		const objMatch = normalized.match(
			/x\s*[=:]?\s*(-?\d+(\.\d+)?)[,;]\s*y\s*[=:]?\s*(-?\d+(\.\d+)?)/
		);
		if (objMatch) {
			return {
				x: Number(objMatch[1]),
				y: Number(objMatch[3]),
			};
		}

		throw new Error("Unable to parse coordinate string: " + input);
	}

	// 统一字符串标准化处理
	static #normalizeString(str) {
		// 全角转半角
		str = str.replace(/[\uFF01-\uFF5E]/g, (ch) =>
			String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
		);
		str = str.replace(/\u3000/g, " "); // 全角空格

		// 全角逗号分号替换为半角
		str = str.replace(/[，、；]/g, (s) => {
			if (s === "，") return ",";
			return ";";
		});

		// 替换其他分隔符为统一格式
		str = str.replace(/[;、]/g, ","); // 全部变成逗号

		// 把空白替换为逗号
		str = str.replace(/\s+/g, ",");

		// 可能出现连续逗号，合并之
		str = str.replace(/,+/g, ",");

		// 去掉前后逗号
		str = str.replace(/^,|,$/g, "");

		return str.toLowerCase();
	}
}

class UniverseGrid {
	constructor(maxX, maxY) {
		const step = 250,
			gap = 750,
			unitDistance = 10;
		this.unitDistance = unitDistance;

		this.initialPoints = [];
		this.pathfinderPaths = [];

		for (let x = step; x <= maxX; x += gap) {
			for (let y = step; y <= maxY; y += gap) {
				this.initialPoints.push({ x, y });
			}
		}
		this.spaceStations = new Set();
		this.kdTree = this.#buildKDTree(this.initialPoints);
	}

	// 核心通用坐标解析
	#parsePoint(input) {
		return CoordinateParser.parse(input);
	}

	#parseMultiplyPoints(...args) {
		if (args.length === 1) {
			if (Array.isArray(args[0])) {
				return args[0].map((ele) => this.#parsePoint(ele));
			} else if (typeof args[0] === "object") {
				return Object.values(args[0]).map((value) =>
					this.#parsePoint(value)
				);
			}
		} else if (
			args.length === 4 &&
			args.every((a) => typeof a === "number")
		) {
			return [
				{ x: args[0], y: args[1] },
				{ x: args[2], y: args[3] },
			];
		} else if (args.length === 2) {
			return [this.#parsePoint(args[0]), this.#parsePoint(args[1])];
		} else {
			throw new Error("Invalid arguments for two points");
		}
	}

	calculateDistance(...args) {
		const [p1, p2] = this.#parseMultiplyPoints(...args);
		return Math.hypot(p1.x - p2.x, p1.y - p2.y) * this.unitDistance;
	}

	#addSpaceStation(...args) {
		if (args.length === 0) return;
		const point = this.#parsePoint(...args);
		if (point.x < 0 || point.x > 2000 || point.y < 0 || point.y > 2000) {
			throw new Error(`坐标超出范围: (${point.x}, ${point.y})`);
		}
		this.spaceStations.add(point);
	}

	addSpaceStations(...args) {
		if (args.length === 1) {
			if (Array.isArray(args[0])) {
				args[0].forEach((ele) => this.#addSpaceStation(ele));
			} else if (typeof args[0] === "object") {
				Object.values(args[0]).forEach((ele) =>
					this.#addSpaceStation(ele)
				);
			}
		} else if (args.length > 1) {
			args.forEach((point) => this.#addSpaceStation(point));
		}
	}

	clearSpaceStations() {
		this.spaceStations = new Set();
	}

	findNearestPoint(input) {
		const target = this.#parsePoint(input);
		const kdResult = this.#searchKDTree(target);
		const starterSystemOnly = {
			nearest: kdResult.point,
			distance: kdResult.distance * this.unitDistance,
		};

		let best = { point: kdResult.point, distance: kdResult.distance };
		for (const station of this.spaceStations) {
			const d = Math.hypot(target.x - station.x, target.y - station.y);
			if (d < best.distance) {
				best = { point: station, distance: d };
			}
		}
		const withSpaceStation = {
			nearest: best.point,
			distance: best.distance * this.unitDistance,
		};

		return { starterSystemOnly, withSpaceStation };
	}

	findShortestPath(startInput, endInput) {
		const start = this.#parsePoint(startInput);
		const end = this.#parsePoint(endInput);

		const starterPath = this.#runShortestPath(start, end, true);
		const fullPath = this.#runShortestPath(start, end, false);

		return {
			starterSystemOnly: starterPath,
			withSpaceStation: fullPath,
		};
	}

	#calculateSegmentDistance(from, to, starterOnly) {
		if (this.#isStarter(from) && this.#isStarter(to)) return 0;
		if (!starterOnly && this.#isStation(from) && this.#isStation(to))
			return 0;
		return Math.hypot(from.x - to.x, from.y - to.y) * this.unitDistance;
	}

	#runShortestPath(start, end, starterOnly) {
		const nodes = [start, end, ...this.initialPoints];
		if (!starterOnly) nodes.push(...this.spaceStations);

		const edges = new Map();

		for (let i = 0; i < nodes.length; i++) {
			edges.set(i, []);
			for (let j = 0; j < nodes.length; j++) {
				if (i === j) continue;

				let dist;
				if (this.#isStarter(nodes[i]) && this.#isStarter(nodes[j])) {
					dist = 0;
				} else if (
					!starterOnly &&
					this.#isStation(nodes[i]) &&
					this.#isStation(nodes[j])
				) {
					dist = 0;
				} else {
					dist =
						Math.hypot(
							nodes[i].x - nodes[j].x,
							nodes[i].y - nodes[j].y
						) * this.unitDistance;
				}
				edges.get(i).push({ to: j, cost: dist });
			}
		}

		const { distance, path } = this.#dijkstra(edges, 0, 1, nodes);
		const pathPoints = path.map((idx) => nodes[idx]);

		const trajectories = [];
		for (let i = 0; i < pathPoints.length - 1; i++) {
			const from = pathPoints[i];
			const to = pathPoints[i + 1];
			const segDistance = this.#calculateSegmentDistance(
				from,
				to,
				starterOnly
			);

			trajectories.push({ from, to, distance: segDistance });
		}

		return { distance, path: pathPoints, trajectories };
	}

	#dijkstra(edges, startIdx, endIdx, nodes) {
		const dist = Array(nodes.length).fill(Infinity);
		const prev = Array(nodes.length).fill(null);
		const visited = new Set();
		dist[startIdx] = 0;

		while (visited.size < nodes.length) {
			let u = -1,
				minDist = Infinity;
			for (let i = 0; i < nodes.length; i++) {
				if (!visited.has(i) && dist[i] < minDist) {
					minDist = dist[i];
					u = i;
				}
			}
			if (u === -1) break;

			visited.add(u);
			for (const edge of edges.get(u)) {
				if (dist[u] + edge.cost < dist[edge.to]) {
					dist[edge.to] = dist[u] + edge.cost;
					prev[edge.to] = u;
				}
			}
		}

		const path = [];
		for (let at = endIdx; at !== null; at = prev[at]) {
			path.push(at);
		}
		path.reverse();

		return { distance: dist[endIdx], path };
	}

	#isStarter(p) {
		return this.initialPoints.some((pt) => pt.x === p.x && pt.y === p.y);
	}
	#isStation(p) {
		return Array.from(this.spaceStations).some(
			(pt) => pt.x === p.x && pt.y === p.y
		);
	}

	#buildKDTree(points, depth = 0) {
		if (points.length === 0) return null;
		const axis = depth % 2 ? "y" : "x";
		points.sort((a, b) => a[axis] - b[axis]);
		const median = Math.floor(points.length / 2);
		return {
			point: points[median],
			left: this.#buildKDTree(points.slice(0, median), depth + 1),
			right: this.#buildKDTree(points.slice(median + 1), depth + 1),
			axis,
		};
	}

	#searchKDTree(target) {
		let best = { point: null, distance: Infinity };
		const search = (node) => {
			if (!node) return;
			const d = Math.hypot(
				target.x - node.point.x,
				target.y - node.point.y
			);
			if (d < best.distance) best = { point: node.point, distance: d };
			const diff = target[node.axis] - node.point[node.axis];
			const primary = diff < 0 ? node.left : node.right;
			const secondary = diff < 0 ? node.right : node.left;
			search(primary);
			if (Math.abs(diff) < best.distance) search(secondary);
		};
		search(this.kdTree);
		return best;
	}
}

// Initialize the map when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
	let universeMap = null;

	// Function to initialize the map
	function initializeMap() {
		if (!universeMap) {
			// universeMap = new UniverseMap('universeMap');
			universeMap = new UniverseMapExtended("universeMap");
		}
		universeMap.draw();
	}

	// Add button to load systems
	const loadButton = document.getElementById("loadSystemsBtn");
	const apiKeyInput = document.getElementById("systems_api_key");

	const selfCheck = document.getElementById("start_at_self");
	const starterPointI = document.getElementById("starterPoint");
	const destinationPointI = document.getElementById("destinationPoint");
	const findShortestPath = document.getElementById("findShortestPath");

	// Load saved API key from localStorage
	if (apiKeyInput) {
		const savedApiKey = localStorage.getItem("systems_api_key");
		if (savedApiKey) {
			apiKeyInput.value = savedApiKey;
		}
	}

	selfCheck.addEventListener("click", (evt) => {
		if (!universeMap.playerPosition) {
			evt.preventDefault();
			alert("请先载入星图!");
			return;
		}
		starterPointI.disabled = evt.target.checked;
		starterPointI.value = evt.target.checked
			? CoordinateParser.parse(universeMap.playerPosition)
			: "";
	});

	findShortestPath.addEventListener("click", () => {
		if (!universeMap.playerPosition) {
			alert("请先载入星图!");
			return;
		}
		if (!starterPointI.value || !destinationPointI.value) {
			alert("请正确输入坐标!");
			return;
		}
		const paths = universeMap.universeGrid.findShortestPath(
			starterPointI.value,
			destinationPointI.value
		);
		const tra = paths.starterSystemOnly.trajectories ?? null;
		if (tra) {
			cancelAnimationFrame(universeMap.trajctoryAnimation);
			universeMap.pushTrajectories(tra);
			universeMap.startTrajectoryAnimation();
		} else {
			universeMap.clearTrajectories();
			cancelAnimationFrame(universeMap.trajctoryAnimation);
		}
	});

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
