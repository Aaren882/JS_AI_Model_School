// 全局變量
let selectedDepartment = null;
let selectedUniversity = null;
let universityData = {};
let originalUniversityData = {};
let currentYear = "111"; // 預設年份
let currentDisplayMode = "group"; // 預設顯示模式：系組
Chart.register(ChartDataLabels);

// DOM 元素
const searchBox = document.querySelector(".search-box");
const universityList = document.getElementById("universityList");
const selectedTitle = document.getElementById("selected-title");
const selectedInfo = document.getElementById("selected-info");
const yearButtons = document.querySelectorAll(".year-button");
const modeButtons = document.querySelectorAll(".mode-button");
const AITextBox = document.getElementById("AI-input-area");

// 從CSV文件讀取資料
async function loadSchoolData(year = "111") {
	try {
		let response = await fetch(`/api/getAllSchool?year=${year}`);
		if (!response.ok) {
			throw new Error(`無法載入 ${year} 年資料`);
		}

		let response_Data = await response.json();
		originalUniversityData = response_Data; //- Update school data

		return parseSchoolData(response_Data);
	} catch (error) {
		console.error(`無法讀取 ${year} 年的資料`, error);
		return {};
	}
}

// 解析學校數據
function parseSchoolData(schoolData) {
	const data = {};
	for (let i = 0; i < schoolData.length; i++) {
		const elem = schoolData[i];
		const {
			//- #NOTE - all the query name will be lowercase
			schoolcode,
			schoolname,
			deptcode,
			deptname,
			category,
		} = elem;

		let curData = data[schoolcode];
		if (!curData) {
			data[schoolcode] = {
				name: schoolname,
				departments: {},
			};
			curData = data[schoolcode];
		}

		let curDepartment = curData.departments[deptcode];
		if (!curDepartment) {
			curData.departments[deptcode] = {
				name: deptname,
				categories: [],
			};
			curDepartment = curData.departments[deptcode];
			curDepartment.categories.push(category);
		}
	}

	return data;
}

function dataParser(searchDept, joinElements = ["schoolname"]) {
	let searched = originalUniversityData.find((x) => x.deptcode === searchDept);

	return joinElements.map((x) => searched[x]);
}

function localizeDept(searchDept, joinElements = ["schoolname"], split = "/") {
	return dataParser(searchDept, joinElements).join(split);
}

// 簡化群別名稱
function simplifyCategory(category) {
	const mapping = {
		"01 機械群": "機械",
		"02 動力機械群": "動機",
		"03 電機與電子群電機類": "電機",
		"04 電機與電子群資電類": "資電",
		"05 化工群": "化工",
		"06 土木與建築群": "土木",
		"07 設計群": "設計",
		"08 工程與管理類": "工管",
		"09 商業與管理群": "商管",
		"10 衛生與護理類": "衛護",
		"11 食品群": "食品",
		"12 家政群幼保類": "幼保",
		"13 家政群生活應用類": "家政",
		"14 農業群": "農業",
		"15 外語群英語類": "英語",
		"16 外語群日語類": "日語",
		"17 餐旅群": "餐旅",
		"18 海事群": "海事",
		"19 水產群": "水產",
		"20 藝術群影視類": "影視",
		"21 資管類": "資管",
	};
	return mapping[category] || category;
}

// 根據顯示模式生成不同的列表
function generateUniversityList(data, displayMode) {
	let html = "";

	if (displayMode === "school") {
		// 學校模式：只顯示學校，不可展開
		Object.keys(data).forEach((schoolCode) => {
			const school = data[schoolCode];
			html += `
                <li class="university-group">
                    <div class="university-item" data-code="${schoolCode}" data-type="school">
                        ${schoolCode} - ${school.name}
                    </div>
                </li>
            `;
		});
	} else if (displayMode === "department") {
		// 系所模式：學校可展開，顯示去重複的系所
		Object.keys(data).forEach((schoolCode) => {
			const school = data[schoolCode];

			// 收集並去重複系所
			const uniqueDepartments = {};
			Object.keys(school.departments).forEach((deptCode) => {
				const dept = school.departments[deptCode];
				if (!uniqueDepartments[dept.name]) {
					uniqueDepartments[dept.name] = {
						codes: [deptCode],
						name: dept.name,
						categories: [...dept.categories],
					};
				} else {
					uniqueDepartments[dept.name].codes.push(deptCode);
					uniqueDepartments[dept.name].categories.push(...dept.categories);
				}
			});

			html += `
                <li class="university-group">
                    <div class="university-header" data-code="${schoolCode}">
                        <span>${schoolCode} - ${school.name}</span>
                        <span class="dropdown-arrow">▼</span>
                    </div>
                    <ul class="department-list">
            `;

			Object.keys(uniqueDepartments).forEach((deptName) => {
				const dept = uniqueDepartments[deptName];
				html += `
                    <li class="department-item" data-codes="${dept.codes.join(
											"|"
										)}" data-categories="${dept.categories.join("|")}">
                        ${dept.name}
                    </li>
                `;
			});

			html += `
                    </ul>
                </li>
            `;
		});
	} else {
		// 系組模式：原始完整顯示
		Object.keys(data).forEach((schoolCode) => {
			const school = data[schoolCode];
			html += `
                <li class="university-group">
                    <div class="university-header" data-code="${schoolCode}">
                        <span>${schoolCode} - ${school.name}</span>
                        <span class="dropdown-arrow">▼</span>
                    </div>
                    <ul class="department-list">
            `;

			Object.keys(school.departments).forEach((deptCode) => {
				const dept = school.departments[deptCode];
				const simplifiedCategories = dept.categories.map(simplifyCategory);
				const categoryText = simplifiedCategories.join(", ");

				html += `
                    <li class="department-item" data-code="${deptCode}" data-categories="${dept.categories.join(
					"|"
				)}">
                        ${deptCode} - [${categoryText}] ${dept.name}
                    </li>
                `;
			});

			html += `
                    </ul>
                </li>
            `;
		});
	}

	return html;
}

// 切換顯示模式
function switchDisplayMode(mode) {
	if (currentDisplayMode === mode) {
		return;
	}

	currentDisplayMode = mode;

	// 更新按鈕狀態
	modeButtons.forEach((btn) => {
		btn.classList.remove("active");
		if (btn.getAttribute("data-mode") === mode) {
			btn.classList.add("active");
		}
	});

	// 重新生成列表
	const html = generateUniversityList(universityData, currentDisplayMode);
	universityList.innerHTML = html;

	// 重新初始化事件監聽器
	initializeEventListeners();

	// 清空搜尋框
	searchBox.value = "";

	// 重置選擇狀態
	resetSelection();

	console.log(`切換到${mode}模式`);
}

// 切換年份功能
async function switchYear(year) {
	// 如果已經是當前年份，不需要重新載入
	if (currentYear === year) {
		return;
	}

	// 顯示載入中狀態
	universityList.innerHTML =
		'<li style="padding: 10px; color: #666; text-align: center;">載入中...</li>';

	try {
		// 載入新年份的資料
		const newData = await loadSchoolData(year);
		if (Object.keys(newData).length === 0) {
			// 如果載入失敗，顯示錯誤訊息但不改變年份
			universityList.innerHTML = `<li style="padding: 10px; color: #ff6b6b; text-align: center;">無法載入 ${year} 年資料</li>`;
			return;
		}

		// 更新全局變量
		currentYear = year;
		universityData = newData;
		// originalUniversityData = JSON.parse(JSON.stringify(newData));

		// 更新年份按鈕狀態
		yearButtons.forEach((btn) => {
			btn.classList.remove("active");
			if (btn.getAttribute("data-year") === year) {
				btn.classList.add("active");
			}
		});

		// 重新生成列表
		const html = generateUniversityList(universityData, currentDisplayMode);
		universityList.innerHTML = html;

		// 重新初始化事件監聽器
		initializeEventListeners();

		// 清空搜尋框
		searchBox.value = "";

		// 重置選擇狀態
		resetSelection();

		console.log(
			`成功切換到 ${year} 年資料，共載入`,
			Object.keys(universityData).length,
			"所學校"
		);
	} catch (error) {
		console.error("切換年份時發生錯誤:", error);
		universityList.innerHTML = `<li style="padding: 10px; color: #ff6b6b; text-align: center;">載入 ${year} 年資料時發生錯誤</li>`;
	}
}

// 重置選擇狀態
function resetSelection() {
	selectedDepartment = null;
	selectedUniversity = null;
	selectedTitle.textContent = "尚未選擇學校";
	selectedInfo.textContent = "請從左側列表選擇學校或科系";
	selectedInfo.classList.add("no-selection");
}

// 初始化年份按鈕事件監聽器
function initializeYearButtons() {
	yearButtons.forEach((button) => {
		button.addEventListener("click", function () {
			const year = this.getAttribute("data-year");
			switchYear(year);
		});
	});
}

// 初始化顯示模式按鈕事件監聽器
function initializeModeButtons() {
	modeButtons.forEach((button) => {
		button.addEventListener("click", function () {
			const mode = this.getAttribute("data-mode");
			switchDisplayMode(mode);
		});
	});
}

// 初始化數據和UI
async function initializeData() {
	try {
		universityData = await loadSchoolData(currentYear);
		// originalUniversityData = JSON.parse(JSON.stringify(universityData)); // 深拷貝

		if (Object.keys(universityData).length === 0) {
			universityList.innerHTML =
				'<li style="padding: 10px; color: #666;">無法載入資料，請確認CSV檔案已上傳</li>';
			return;
		}

		const html = generateUniversityList(universityData, currentDisplayMode);
		universityList.innerHTML = html;

		initializeEventListeners();

		console.log(
			"資料載入完成，共載入",
			Object.keys(universityData).length,
			"所學校"
		);
	} catch (error) {
		console.error("初始化資料時發生錯誤:", error);
		universityList.innerHTML =
			'<li style="padding: 10px; color: #ff6b6b;">載入資料時發生錯誤</li>';
	}
}

// 初始化事件監聽器
function initializeEventListeners() {
	if (currentDisplayMode === "school") {
		// 學校模式：直接點擊學校項目
		document.querySelectorAll(".university-item").forEach((item) => {
			item.addEventListener("click", function () {
				// 移除所有選中狀態
				document
					.querySelectorAll(".university-item")
					.forEach((i) => i.classList.remove("selected"));

				// 添加選中狀態
				this.classList.add("selected");

				// 更新選中信息
				updateSelectedSchool(this);
			});
		});
	} else {
		// 系所和系組模式：學校標題點擊事件
		document.querySelectorAll(".university-header").forEach((header) => {
			header.addEventListener("click", function () {
				const departmentList = this.nextElementSibling;
				const isActive = this.classList.contains("active");

				// 關閉所有其他下拉選單
				document
					.querySelectorAll(".university-header")
					.forEach((h) => h.classList.remove("active"));
				document
					.querySelectorAll(".department-list")
					.forEach((dl) => dl.classList.remove("active"));

				// 切換當前選單
				if (!isActive) {
					this.classList.add("active");
					departmentList.classList.add("active");
				}
			});
		});

		// 科系項目點擊事件
		document.querySelectorAll(".department-item").forEach((item) => {
			item.addEventListener("click", function () {
				// 移除所有選中狀態
				document
					.querySelectorAll(".department-item")
					.forEach((i) => i.classList.remove("selected"));

				// 添加選中狀態
				this.classList.add("selected");

				// 更新選中信息
				updateSelectedDepartment(this);
			});
		});
	}

	// 搜尋功能
	searchBox.addEventListener("input", function () {
		const searchTerm = this.value.toLowerCase();
		searchUniversitiesAndDepartments(searchTerm);
	});
}

// 更新選中學校顯示（學校模式）
function updateSelectedSchool(schoolElement) {
	const schoolCode = schoolElement.getAttribute("data-code");
	const school = universityData[schoolCode];

	selectedTitle.textContent = school.name;
	selectedInfo.innerHTML = `
        學校代碼: ${schoolCode} | 年份: ${currentYear}<br>
        模式: 學校模式
    `;
	selectedInfo.classList.remove("no-selection");

	selectedUniversity = {
		year: currentYear,
		universityCode: schoolCode,
		universityName: school.name,
		mode: "school",
		fullText: `${school.name} (${currentYear}年)`,
	};

	console.log("選中學校:", selectedUniversity);
}

// 更新選中科系顯示
function updateSelectedDepartment(departmentElement) {
	const universityHeader = departmentElement
		.closest(".university-group")
		.querySelector(".university-header");
	const schoolCode = universityHeader.getAttribute("data-code");
	const school = universityData[schoolCode];

	let departmentInfo = {};

	if (currentDisplayMode === "department") {
		// 系所模式
		const deptCodes = departmentElement.getAttribute("data-codes").split("|");
		const categories = departmentElement
			.getAttribute("data-categories")
			.split("|");
		const deptName = departmentElement.textContent.trim();

		departmentInfo = {
			year: currentYear,
			universityCode: schoolCode,
			universityName: school.name,
			departmentCodes: deptCodes,
			departmentName: deptName,
			categories: categories,
			mode: "department",
			fullText: `${school.name} - ${deptName} (${currentYear}年)`,
		};

		selectedTitle.textContent = `${school.name} - ${deptName}`;
		selectedInfo.innerHTML = `
            學校代碼: ${schoolCode} | 科系代碼: ${deptCodes.join(
			", "
		)} | 年份: ${currentYear}<br>
            模式: 系所模式 | 招生群別: ${categories.join(", ")}
        `;
	} else {
		// 系組模式
		const deptCode = departmentElement.getAttribute("data-code");
		const categories = departmentElement
			.getAttribute("data-categories")
			.split("|");
		const dept = school.departments[deptCode];

		departmentInfo = {
			year: currentYear,
			universityCode: schoolCode,
			universityName: school.name,
			departmentCode: deptCode,
			departmentName: dept.name,
			categories: categories,
			mode: "group",
			fullText: `${school.name} - ${dept.name} (${currentYear}年)`,
		};
		const code = deptCode;

		// 載入並繪製 network
		fetch(`api/getRelationData?year=${currentYear}&id=${deptCode}`)
			.then((res) => res.json())
			.then((relations) => {
				const edges = relations;
				const nodes = [];
				relations.flat().forEach((n) => {
					if (!nodes.includes(n)) {
						nodes.push(n);
					}
				});

				drawLineChart(
					"chart-line-1",
					nodes,
					"一階通過率",
					"firststagepassrate"
				);
				drawDualAxisLineChart("chart-line-2", nodes, "r_score", "avg");
				drawLineChart(
					"chart-line-3",
					nodes,
					"正備取有效性",
					"admissionvalidity"
				);
				drawLineChart("chart-line-4", nodes, "正取有效性", "posvalid");
				renderNetwork(nodes, edges);
			})
			.catch((err) => {
				console.error(`載入關係圖失敗:`, err);
			});

		selectedTitle.textContent = `${school.name} - ${dept.name}`;
		selectedInfo.innerHTML = `
            學校代碼: ${schoolCode} | 科系代碼: ${deptCode} | 年份: ${currentYear}<br>
            模式: 系組模式 | 招生群別: ${categories.join(", ")}
        `;

		//- Get AI analyze
		fetch(`/api/getSchoolAnalyze?year=${currentYear}&schoolID=${deptCode}`)
			.then(async (res) => {
				let { chat } = await res.json();
				AITextBox.innerHTML = chat;
			})
			.catch((e) => {
				AITextBox.textContent = `${e.message}`;
			});
	}

	selectedInfo.classList.remove("no-selection");
	selectedDepartment = departmentInfo;

	console.log("選中科系:", selectedDepartment);
}

// 搜尋功能
function searchUniversitiesAndDepartments(searchTerm) {
	if (currentDisplayMode === "school") {
		// 學校模式搜尋
		const universityItems = document.querySelectorAll(".university-item");
		universityItems.forEach((item) => {
			const itemText = item.textContent.toLowerCase();
			if (itemText.includes(searchTerm) || searchTerm === "") {
				item.parentElement.style.display = "block";
			} else {
				item.parentElement.style.display = "none";
			}
		});
	} else {
		// 系所和系組模式搜尋
		const universityGroups = document.querySelectorAll(".university-group");

		universityGroups.forEach((group) => {
			const header = group.querySelector(".university-header");
			const departmentList = group.querySelector(".department-list");
			const departments = group.querySelectorAll(".department-item");

			const universityText = header.textContent.toLowerCase();
			let hasVisibleDepartments = false;

			// 檢查科系是否匹配
			departments.forEach((dept) => {
				const deptText = dept.textContent.toLowerCase();
				if (deptText.includes(searchTerm) || searchTerm === "") {
					dept.style.display = "block";
					hasVisibleDepartments = true;
				} else {
					dept.style.display = "none";
				}
			});

			// 檢查學校是否匹配或有可見科系
			if (
				universityText.includes(searchTerm) ||
				hasVisibleDepartments ||
				searchTerm === ""
			) {
				group.style.display = "block";

				// 如果是搜尋結果，自動展開
				if (
					searchTerm &&
					(universityText.includes(searchTerm) || hasVisibleDepartments)
				) {
					header.classList.add("active");
					departmentList.classList.add("active");
				}
			} else {
				group.style.display = "none";
			}

			// 如果學校匹配但沒有科系匹配，顯示所有科系
			if (universityText.includes(searchTerm) && searchTerm !== "") {
				departments.forEach((dept) => {
					dept.style.display = "block";
				});
			}
		});

		// 清空搜尋時恢復所有項目
		if (searchTerm === "") {
			universityGroups.forEach((group) => {
				group.style.display = "block";
				const header = group.querySelector(".university-header");
				const departmentList = group.querySelector(".department-list");
				const departments = group.querySelectorAll(".department-item");

				header.classList.remove("active");
				departmentList.classList.remove("active");
				departments.forEach((dept) => {
					dept.style.display = "block";
				});
			});
		}
	}
}

// 圖片容器點擊事件
function initializeImageContainers() {
	const imageContainers = document.querySelectorAll(".image-container");
	imageContainers.forEach((container) => {
		container.addEventListener("mouseenter", function () {
			this.style.cursor = "pointer";
		});

		container.addEventListener("click", function () {
			const label =
				this.querySelector(".image-label")?.textContent || "社群網路圖";
			if (selectedDepartment || selectedUniversity) {
				const selected = selectedDepartment || selectedUniversity;
				console.log(`${selected.fullText} - ${label}`);
				console.log("選中的詳細資訊:", selected);
			} else {
				console.log(`請先選擇學校或科系 - ${label}`);
			}
		});
	});
}

// 初始化所有功能
document.addEventListener("DOMContentLoaded", function () {
	initializeYearButtons(); // 初始化年份按鈕
	initializeModeButtons(); // 初始化模式按鈕
	initializeData();
	initializeImageContainers();
});

// 導出函數供外部使用
window.getSelectedDepartment = function () {
	return selectedDepartment;
};

window.getSelectedUniversity = function () {
	return selectedUniversity;
};

window.getUniversityData = function () {
	return universityData;
};

window.getCurrentYear = function () {
	return currentYear;
};

window.getCurrentDisplayMode = function () {
	return currentDisplayMode;
};

// 新增：取得原始CSV資料的函數
/* window.getOriginalCSVData = function () {
	return originalUniversityData;
}; */

// 新增：重新載入CSV資料的函數
window.reloadCSVData = async function () {
	await initializeData();
};

// 新增：手動切換年份的函數
window.switchToYear = function (year) {
	return switchYear(year);
};

// 新增：手動切換顯示模式的函數
window.switchToDisplayMode = function (mode) {
	return switchDisplayMode(mode);
};

function renderNetwork(nodes, edges) {
	const placeholder = document.querySelector(".placeholder-text");
	if (placeholder) placeholder.style.display = "block";

	cytoscape({
		container: document.getElementById("network-container"),
		elements: [
			...nodes.map((n) => ({
				data: {
					id: n,
					label: localizeDept(n, [
						"deptcode",
						"schoolname",
						"deptname",
						"r_score",
					]),
				},
			})),
			...edges.map((e) => ({ data: { source: e[0], target: e[1] } })),
		],

		layout: {
			name: "cose",
			idealEdgeLength: 160, // 適中邊長，避免節點擠在一起
			nodeRepulsion: 8000000, // 高排斥力，節點會分得開
			gravity: 2, // 減低重力，避免向中心集中
			numIter: 1500, // 多跑一些迭代讓圖更穩定
			initialTemp: 200, // 初始運動能量
			coolingFactor: 0.95, // 冷卻速度
			animate: true,
			fit: true, // 自動縮放適應畫布
			padding: 30,
			headless: false,
		},
		style: [
			{
				selector: "node",
				style: {
					label: "data(label)",
					"background-color": "#667eea",
					color: "#000000",
					"text-valign": "center",
					"text-halign": "center",
					"font-size": "12px",
					width: 40,
					height: 40,
					"text-wrap": "wrap",
					"text-max-width": 100,
				},
			},
			{
				selector: "edge",
				style: {
					width: 2,
					"line-color": "#ba2929",
					"source-arrow-color": "#ba2929", //- #NOTE : they're pointing to the winner
					"source-arrow-shape": "triangle",
					"curve-style": "bezier",
				},
			},
		],
	});
	console.log("社群網路圖已渲染");
}
const chartInstances = {};

// 安全畫圖：先 destroy 再 new
function safeDraw(containerId, chartConfig) {
	if (chartInstances[containerId]) {
		chartInstances[containerId].destroy();
	}
	const ctx = document.getElementById(containerId);
	chartInstances[containerId] = new Chart(ctx, chartConfig);
}
function drawLineChart(containerId, nodes, chartName = "", dataKey = "") {
	const values = nodes.map((d) => parseFloat(localizeDept(d, [dataKey])));
	const labels = nodes.map((d) => dataParser(d, ["schoolname", "deptname"]));

	safeDraw(containerId, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: chartName,
					data: values,
					borderColor: "#3e95cd",
					fill: false,
					tension: 0.4,
				},
			],
		},
		options: {
			responsive: true,
			plugins: {
				datalabels: {
					color: "#000",
					align: "top",
					formatter: function (value) {
						return value.toFixed(2); // 小數點兩位
					},
					font: { size: 10 },
				},
				title: { display: true, text: chartName },
			},
		},
	});
}
function drawDualAxisLineChart(containerId, nodes, rKey = "", avgKey = "") {
	const labels = nodes.map((d) => dataParser(d, ["schoolname", "deptname"]));
	const rValues = nodes.map((d) => parseFloat(localizeDept(d, [rKey])));
	const avgValues = nodes.map((d) => parseFloat(localizeDept(d, [avgKey])));

	safeDraw(containerId, {
		type: "line",
		data: {
			labels: labels,
			datasets: [
				{
					label: rKey,
					data: rValues,
					borderColor: "#3e95cd",
					yAxisID: "y1",
					fill: false,
					tension: 0.4,
				},
				{
					label: avgKey,
					data: avgValues,
					borderColor: "#ff9800",
					yAxisID: "y2",
					fill: false,
					tension: 0.4,
				},
			],
		},
		options: {
			responsive: true,
			plugins: {
				title: {
					display: true,
					text: `${rKey} & ${avgKey}`,
				},
				datalabels: {
					color: "#000",
					align: "top",
					formatter: function (value) {
						return value.toFixed(2); // 小數點兩位
					},
					font: { size: 10 },
				},
			},
			scales: {
				y1: {
					type: "linear",
					position: "left",
					min: 0,
					max: 100,
					display: true,
					title: { display: true, text: rKey },
				},
				y2: {
					type: "linear",
					position: "right",
					min: 0,
					max: 100,
					display: true,
					grid: { drawOnChartArea: false },
					title: { display: true, text: avgKey },
				},
			},
		},
	});
}
