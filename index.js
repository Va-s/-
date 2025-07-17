import {
  WebGLRenderer,
  PerspectiveCamera,
  Scene,
  Mesh,
  PlaneGeometry,
  DirectionalLight,
  PCFSoftShadowMap,
  Color,
  AmbientLight,
  Box3,
  LoadingManager,
  MeshPhysicalMaterial,
  DoubleSide,
  ACESFilmicToneMapping,
  Float32BufferAttribute,
  RepeatWrapping,
  CanvasTexture, // 新增这一行！
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// 新增：导入CSS2D相关模块（用于关节标签）
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import URDFLoader from "urdf-loader";
import { setupKeyboardControls, setupControlPanel } from "./robotControls.js";

// 声明全局变量
let scene, camera, renderer, controls;
let labelRenderer; // 关节标签渲染器（新增）
window.robot = null;
let keyboardUpdate;

// 初始化场景并启动
init();
render();

function init() {
  // 创建场景
  scene = new Scene();
  scene.background = new Color(0x263238);

  // 创建相机
  camera = new PerspectiveCamera();
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  // 创建渲染器
  renderer = new WebGLRenderer({ antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.physicallyCorrectLights = true;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;
  document.body.appendChild(renderer.domElement);

  // 新增：初始化关节标签渲染器（用于显示关节独立提示）
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0px";
  labelRenderer.domElement.style.pointerEvents = "none"; // 允许鼠标穿透标签操作场景
  document.body.appendChild(labelRenderer.domElement);

  // 添加主方向光（带阴影）
  const directionalLight = new DirectionalLight(0xffffff, 1.0);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.setScalar(1024);
  directionalLight.position.set(5, 30, 5);
  scene.add(directionalLight);

  // 添加辅助方向光（增强反射）
  const directionalLight2 = new DirectionalLight(0xffffff, 0.8);
  directionalLight2.position.set(-2, 10, -5);
  scene.add(directionalLight2);

  // 添加环境光
  const ambientLight = new AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);

  // 创建天空盒（一个大立方体，反转法线使其内部可见）
  // const skyboxGeometry = new BoxGeometry(1000, 1000, 1000); // 足够大的立方体
  // const skyboxMaterial = new MeshBasicMaterial({
  //   color: 0xffffff,
  //   side: BackSide, // 只渲染内部
  //   onBeforeCompile: (shader) => {
  //     // 自定义渐变着色器（从上到下的渐变）
  //     shader.fragmentShader = `
  //       varying vec2 vUv;
  //       void main() {
  //         // 定义渐变颜色（顶部深蓝色，底部浅蓝色）
  //         vec3 topColor = vec3(0.1, 0.2, 0.4); // 顶部颜色
  //         vec3 bottomColor = vec3(0.6, 0.8, 0.9); // 底部颜色
  //         // 计算渐变因子（基于Y坐标）
  //         float factor = vUv.y; // 0-1范围（底部到顶部）
  //         vec3 color = mix(bottomColor, topColor, factor);
  //         gl_FragColor = vec4(color, 1.0);
  //       }
  //     `;
  //   },
  // });

  // const skybox = new Mesh(skyboxGeometry, skyboxMaterial);
  // scene.add(skybox); // 添加到场景

  // 创建带反射的地面（类似MuJoCo风格）
  const groundMaterial = new MeshPhysicalMaterial({
    color: 0x808080,
    metalness: 0.7,
    roughness: 0.3,
    reflectivity: 0.1,
    clearcoat: 0.3,
    side: DoubleSide,
    transparent: true,
    opacity: 0.7,
  });

  // 创建格子纹理地面
  const gridSize = 60;
  const divisions = 60;
  const ground = new Mesh(
    new PlaneGeometry(gridSize, gridSize, divisions, divisions),
    groundMaterial
  );

  // 添加格子纹理UV坐标
  const geometry = ground.geometry;
  const positionAttribute = geometry.getAttribute("position");
  const uvs = [];
  const gridScale = 0.01;

  for (let i = 0; i < positionAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    uvs.push(x * gridScale, y * gridScale);
  }

  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  groundMaterial.map = createGridTexture();
  groundMaterial.roughnessMap = createGridTexture();

  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // 创建轨道控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = 4;
  controls.target.y = 1;
  controls.update();

  // 加载机器人模型
  loadModelFromHash();

  // 初始化窗口大小并监听 resize 事件
  onResize();
  window.addEventListener("resize", onResize);

  // 初始化控制面板UI
  setupControlPanel();
}

/**
 * 从URL哈希加载模型（默认加载genkiarm）
 */
function loadModelFromHash() {
  let modelToLoad = 'genkiarm'; // 默认模型
  // let modelToLoad = "pr2";

  // 加载模型
  const manager = new LoadingManager();
  const loader = new URDFLoader(manager);

  loader.load(`/URDF/${modelToLoad}.urdf`, result => {
    window.robot = result;
  });

  // loader.load(
  //   `/example-robot-data-master/robots/pr2_description/urdf/${modelToLoad}.urdf`,
  //   (result) => {
  //     window.robot = result;
  //   }
  // );

  // 模型加载完成后初始化
  manager.onLoad = () => {
    // 调整机器人姿态
    window.robot.rotation.x = -Math.PI / 2;
    window.robot.rotation.z = -Math.PI;
    window.robot.traverse((c) => {
      c.castShadow = true; // 启用阴影
    });

    // 输出关节信息到控制台
    console.log(window.robot.joints);
    logJointLimits(window.robot);

    // 调整机器人位置和缩放
    window.robot.updateMatrixWorld(true);
    const bb = new Box3();
    bb.setFromObject(window.robot);
    window.robot.scale.set(15, 15, 15);
    window.robot.position.y -= bb.min.y;
    scene.add(window.robot);

    // 初始化键盘控制
    keyboardUpdate = setupKeyboardControls(window.robot);

    // 初始化关节监控系统（包含关节独立提示）
    window.jointMonitor = new JointMonitor(window.robot);
  };
}

/**
 * 输出关节限制信息到控制台
 * @param {Object} robot - 机器人对象
 */
function logJointLimits(robot) {
  if (!robot || !robot.joints) return;

  console.log("Robot joint limits:");
  Object.entries(robot.joints).forEach(([name, joint]) => {
    console.log(`Joint: ${name}`);
    console.log(`  Type: ${joint.jointType}`);

    if (joint.jointType !== "fixed" && joint.jointType !== "continuous") {
      const lowerDegree = ((joint.limit.lower * 180) / Math.PI).toFixed(2);
      const upperDegree = ((joint.limit.upper * 180) / Math.PI).toFixed(2);
      console.log(
        `  Limits: ${joint.limit.lower.toFixed(
          4
        )} to ${joint.limit.upper.toFixed(
          4
        )} rad (${lowerDegree}° to ${upperDegree}°}`
      );
      console.log(
        `  Current value: ${
          Array.isArray(joint.jointValue)
            ? joint.jointValue.join(", ")
            : joint.jointValue
        }`
      );
    } else if (joint.jointType === "continuous") {
      console.log(`  No limits (continuous joint)`);
    } else {
      console.log(`  No limits (fixed joint)`);
    }
  });
}

/**
 * 窗口大小调整处理
 */
function onResize() {
  // 更新主渲染器
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // 更新标签渲染器（关节提示标签）
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * 渲染循环
 */
function render() {
  requestAnimationFrame(render);

  // 更新键盘控制（如果已初始化）
  if (keyboardUpdate) {
    keyboardUpdate();
  }

  // 渲染3D场景
  renderer.render(scene, camera);
  // 渲染关节提示标签（跟随关节位置）
  labelRenderer.render(scene, camera);
}

/**
 * 创建格子纹理
 * @returns {CanvasTexture} 格子纹理对象
 */
function createGridTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;

  const context = canvas.getContext("2d");
  // 填充底色
  context.fillStyle = "#808080";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // 绘制格子线
  context.lineWidth = 1;
  context.strokeStyle = "#606060";
  const cellSize = 32;

  // 竖线
  for (let i = 0; i <= canvas.width; i += cellSize) {
    context.beginPath();
    context.moveTo(i, 0);
    context.lineTo(i, canvas.height);
    context.stroke();
  }

  // 横线
  for (let i = 0; i <= canvas.height; i += cellSize) {
    context.beginPath();
    context.moveTo(0, i);
    context.lineTo(canvas.width, i);
    context.stroke();
  }

  // 创建纹理并设置重复模式
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(10, 10);

  return texture;
}

/**
 * 关节监控系统（含关节独立提示标签）
 */
class JointMonitor {
  constructor(robot) {
    this.robot = robot;
    this.jointData = {}; // 关节数据（温度、湿度、压力等）
    this.alerts = {}; // 报警状态
    this.uiElements = {}; // 监控面板UI元素
    this.jointLabels = {}; // 关节独立提示标签（关键新增）

    // 初始化流程
    this.initializeJointMonitoring();
    this.createMonitoringPanel();
    this.createJointLabels(); // 创建关节独立提示标签
    // 启动数据更新循环（每秒1次）
    setInterval(() => this.updateMonitoringData(), 1000);
  }

  /**
   * 初始化所有关节的监控数据
   */
  initializeJointMonitoring() {
    if (!this.robot || !this.robot.joints) return;

    Object.keys(this.robot.joints).forEach((jointName) => {
      // 初始化关节基础数据
      this.jointData[jointName] = {
        temperature: 25, // 初始温度 (°C)
        humidity: 40, // 初始湿度 (%)
        pressure: 1013, // 初始压力 (hPa)
        status: "normal", // 状态：normal/warning/critical
      };

      // 初始化报警状态
      this.alerts[jointName] = {
        temperature: false,
        humidity: false,
        pressure: false,
      };
    });
  }

  /**
   * 新增：为每个关节创建独立提示标签（跟随关节移动）
   */
  createJointLabels() {
    if (!this.robot || !this.robot.joints) return;

    // 创建标签样式（根据状态显示不同颜色）
    this.createLabelStyles();

    Object.keys(this.robot.joints).forEach((jointName) => {
      // 创建标签DOM元素
      const labelDiv = document.createElement("div");
      labelDiv.className = "joint-label normal"; // 默认正常样式
      labelDiv.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        pointer-events: none;
        white-space: nowrap;
      `;

      // 创建CSS2D对象（将DOM元素绑定到3D空间）
      const labelObject = new CSS2DObject(labelDiv);
      labelObject.name = `label_${jointName}`;

      // 获取关节对应的3D模型节点（标签绑定到关节）
      const jointObject = this.getJointObject(jointName);
      if (jointObject) {
        jointObject.add(labelObject); // 标签跟随关节移动
        labelObject.position.set(0, 0.1, 0); // 标签在关节上方偏移
      }

      this.jointLabels[jointName] = {
        element: labelDiv,
        object: labelObject,
      };
    });
  }

  /**
   * 新增：获取关节对应的3D模型对象
   */
  getJointObject(jointName) {
    let jointObject = null;
    // 遍历机器人模型找到关节对应的3D节点
    this.robot.traverse((child) => {
      if (child.name === jointName || child.userData.jointName === jointName) {
        jointObject = child;
      }
    });
    // 找不到则绑定到机器人根节点（降级处理）
    return jointObject || this.robot;
  }

  /**
   * 新增：创建关节标签样式（状态相关）
   */
  createLabelStyles() {
    if (document.getElementById("joint-label-styles")) return;

    const style = document.createElement("style");
    style.id = "joint-label-styles";
    style.textContent = `
      /* 关节标签基础样式 */
      .joint-label { border: 1px solid transparent; }
      
      /* 状态样式：正常/警告/严重 */
      .joint-label.normal { border-color: #4CAF50; } /* 绿色边框 */
      .joint-label.warning { border-color: #FFC107; } /* 黄色边框 */
      .joint-label.critical { 
        border-color: #F44336; 
        animation: labelBlink 1s infinite; /* 红色边框+闪烁 */
      }
      
      /* 闪烁动画 */
      @keyframes labelBlink {
        0%, 100% { background: rgba(244, 67, 54, 0.8); }
        50% { background: rgba(244, 67, 54, 0.4); }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * 更新监控数据并检查报警
   */
  updateMonitoringData() {
    if (!this.robot || !this.robot.joints) return;

    Object.keys(this.robot.joints).forEach((jointName) => {
      this.simulateSensorReadings(jointName); // 模拟传感器数据
      this.checkAlerts(jointName); // 检查报警
      this.updateUIDisplay(jointName); // 更新监控面板
      this.updateJointLabel(jointName); // 更新关节独立提示标签（新增）
    });
  }

  /**
   * 模拟传感器读数（关节运动时数据变化更明显）
   * @param {string} jointName - 关节名称
   */
  simulateSensorReadings(jointName) {
    const joint = this.robot.joints[jointName];

    // 判断关节是否在运动（运动时数据波动更大）
    const isMoving = joint.jointValue !== joint.lastJointValue;
    const activityFactor = isMoving ? 1.5 : 1.0; // 活动系数

    // 温度模拟（25-60°C，运动时升温更快）
    this.jointData[jointName].temperature = Math.min(
      60,
      this.jointData[jointName].temperature +
        (Math.random() * 0.5 - 0.2) * activityFactor
    );

    // 湿度模拟（30-80%）
    this.jointData[jointName].humidity = Math.max(
      30,
      Math.min(80, this.jointData[jointName].humidity + (Math.random() * 2 - 1))
    );

    // 压力模拟（990-1030 hPa）
    this.jointData[jointName].pressure = Math.max(
      990,
      Math.min(
        1030,
        this.jointData[jointName].pressure + (Math.random() * 0.5 - 0.25)
      )
    );
  }

  /**
   * 检查报警条件并更新状态
   * @param {string} jointName - 关节名称
   */
  checkAlerts(jointName) {
    const data = this.jointData[jointName];
    let newStatus = "normal"; // 默认正常

    // 温度报警检查（>50°C严重，>40°C警告）
    if (data.temperature > 50) {
      this.alerts[jointName].temperature = true;
      newStatus = "critical";
    } else if (data.temperature > 40) {
      this.alerts[jointName].temperature = true;
      newStatus = newStatus === "critical" ? "critical" : "warning";
    } else {
      this.alerts[jointName].temperature = false;
    }

    // 湿度报警检查（>70%严重，>60%警告）
    if (data.humidity > 70) {
      this.alerts[jointName].humidity = true;
      newStatus = "critical";
    } else if (data.humidity > 60) {
      this.alerts[jointName].humidity = true;
      newStatus = newStatus === "critical" ? "critical" : "warning";
    } else {
      this.alerts[jointName].humidity = false;
    }

    // 压力报警检查（超出1000-1025严重，超出1005-1020警告）
    if (data.pressure < 1000 || data.pressure > 1025) {
      this.alerts[jointName].pressure = true;
      newStatus = "critical";
    } else if (data.pressure < 1005 || data.pressure > 1020) {
      this.alerts[jointName].pressure = true;
      newStatus = newStatus === "critical" ? "critical" : "warning";
    } else {
      this.alerts[jointName].pressure = false;
    }

    // 更新状态并记录报警
    data.status = newStatus;
    if (newStatus !== "normal") {
      this.logAlert(jointName, newStatus);
    }
  }

  /**
   * 记录报警信息到控制台
   * @param {string} jointName - 关节名称
   * @param {string} status - 状态（warning/critical）
   */
  logAlert(jointName, status) {
    const data = this.jointData[jointName];
    const alertTypes = [];

    if (this.alerts[jointName].temperature)
      alertTypes.push(`温度异常 (${data.temperature.toFixed(1)}°C)`);
    if (this.alerts[jointName].humidity)
      alertTypes.push(`湿度异常 (${data.humidity.toFixed(1)}%)`);
    if (this.alerts[jointName].pressure)
      alertTypes.push(`压力异常 (${data.pressure.toFixed(1)}hPa)`);

    console.warn(
      `[${status.toUpperCase()}] 关节 ${jointName}: ${alertTypes.join("，")}`
    );
  }

  /**
   * 创建监控面板UI（右上角）
   */
  createMonitoringPanel() {
    const panel = document.createElement("div");
    panel.id = "joint-monitoring-panel";
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      max-height: calc(100vh - 40px);
      overflow-y: auto;
      background-color: rgba(0, 0, 0, 0.7);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: Arial, sans-serif;
      z-index: 100;
    `;

    const header = document.createElement("h3");
    header.textContent = "关节监控系统";
    header.style.cssText = "margin-top: 0; text-align: center;";
    panel.appendChild(header);

    this.panel = panel;
    document.body.appendChild(panel);
  }

  /**
   * 更新关节的监控面板显示
   * @param {string} jointName - 关节名称
   */
  updateUIDisplay(jointName) {
    const data = this.jointData[jointName];

    // 如果没有UI元素则创建
    if (!this.uiElements[jointName]) {
      this.createJointUIElement(jointName);
    }

    // 更新数值显示
    const element = this.uiElements[jointName];
    element.querySelector(
      ".temp-value"
    ).textContent = `${data.temperature.toFixed(1)}°C`;
    element.querySelector(
      ".humidity-value"
    ).textContent = `${data.humidity.toFixed(1)}%`;
    element.querySelector(
      ".pressure-value"
    ).textContent = `${data.pressure.toFixed(1)}hPa`;

    // 更新状态指示器
    const statusIndicator = element.querySelector(".status-indicator");
    statusIndicator.className = "status-indicator";
    statusIndicator.classList.add(`status-${data.status}`);
    if (data.status === "critical") {
      statusIndicator.classList.add("blink");
    } else {
      statusIndicator.classList.remove("blink");
    }
  }

  /**
   * 为单个关节创建监控面板UI元素
   * @param {string} jointName - 关节名称
   */
  createJointUIElement(jointName) {
    const jointElement = document.createElement("div");
    jointElement.className = "joint-info";
    jointElement.style.cssText = `
      margin-bottom: 10px; 
      padding: 8px; 
      border-radius: 3px; 
      border: 1px solid #444;
    `;

    // UI结构
    jointElement.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0;">${jointName}</h4>
        <div class="status-indicator status-normal" style="width: 12px; height: 12px; border-radius: 50%;"></div>
      </div>
      <div class="metrics" style="margin-top: 5px;">
        <div style="display: flex; justify-content: space-between;">
          <span>温度:</span>
          <span class="temp-value">25.0°C</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>湿度:</span>
          <span class="humidity-value">40.0%</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>压力:</span>
          <span class="pressure-value">1013.0hPa</span>
        </div>
      </div>
    `;

    // 添加到面板
    this.panel.appendChild(jointElement);
    this.uiElements[jointName] = jointElement;

    // 添加面板样式
    if (!document.getElementById("monitoring-styles")) {
      const style = document.createElement("style");
      style.id = "monitoring-styles";
      style.textContent = `
        .status-normal { background-color: green; }
        .status-warning { background-color: yellow; }
        .status-critical { background-color: red; }
        
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        
        .blink { animation: blink 1s infinite; }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * 新增：更新关节独立提示标签（显示内容和样式）
   */
  updateJointLabel(jointName) {
    const data = this.jointData[jointName];
    const label = this.jointLabels[jointName];
    if (!label) return;

    // 更新标签内容（关节名+状态+异常项）
    const alertText = this.getAlertText(jointName);
    label.element.innerHTML = `
      <strong>${jointName}</strong><br>
      ${data.status}${alertText ? `<br>${alertText}` : ""}
    `;

    // 更新标签样式（根据状态切换）
    label.element.className = "joint-label";
    label.element.classList.add(data.status);
  }

  /**
   * 新增：生成关节标签的报警提示文本
   */
  getAlertText(jointName) {
    const alerts = this.alerts[jointName];
    const data = this.jointData[jointName];
    const alertTexts = [];

    if (alerts.temperature) {
      alertTexts.push(`温: ${data.temperature.toFixed(1)}°C`);
    }
    if (alerts.humidity) {
      alertTexts.push(`湿: ${data.humidity.toFixed(1)}%`);
    }
    if (alerts.pressure) {
      alertTexts.push(`压: ${data.pressure.toFixed(1)}hPa`);
    }

    return alertTexts.join(" ");
  }
}
