import { MathUtils } from 'three';

// Control mode can be 'keyboard' or 'realtime'
let controlMode = 'keyboard';






/**
 * 显示警告提醒
 * @param {string} type - 提醒类型 ('joint' 虚拟关节限位, 'servo' 真实舵机错误)
 * @param {string} message - 显示的消息
 * @param {number} duration - 显示持续时间(毫秒)，默认3秒
 */
function showAlert(type, message, duration = 3000) {
  const alertId = type === 'joint' ? 'jointLimitAlert' : 'servoLimitAlert';
  const alertElement = document.getElementById(alertId);
  
  if (alertElement) {
    // 设置消息并显示
    alertElement.textContent = message;
    alertElement.style.display = 'block';
    
    // 设置定时器，自动隐藏
    setTimeout(() => {
      alertElement.style.display = 'none';
    }, duration);
  }
}



/**
 * 检查关节值是否在URDF定义的限制范围内
 * @param {Object} joint - 关节对象
 * @param {number} newValue - 新的关节值
 * @returns {boolean} 如果在限制范围内则返回true
 */
function isJointWithinLimits(joint, newValue) {
  // 如果关节类型是continuous或类型是fixed，则没有限制
  if (joint.jointType === 'continuous' || joint.jointType === 'fixed') {
    return true;
  }
  
  // 如果关节设置了ignoreLimits标志，也返回true
  if (joint.ignoreLimits) {
    return true;
  }
  
  // 检查关节值是否在上下限范围内
  // 注意：对于多自由度关节，需要检查每个值
  if (Array.isArray(newValue)) {
    // 对于多自由度关节如planar、floating等
    return true; // 这种情况较为复杂，需要根据实际情况处理
  } else {
    // 对于单自由度关节，如revolute或prismatic
    return newValue >= joint.limit.lower && newValue <= joint.limit.upper;
  }
}

/**
 * 设置键盘控制
 * @param {Object} robot - 要控制的机器人对象
 * @returns {Function} 用于在渲染循环中更新关节的函数
 */
export function setupKeyboardControls(robot) {
  const keyState = {};
  // Get the keyboard control section element
  const keyboardControlSection = document.getElementById('keyboardControlSection');
  let keyboardActiveTimeout;

  // Get initial stepSize from the HTML slider
  const speedControl = document.getElementById('speedControl');
  let stepSize = speedControl ? MathUtils.degToRad(parseFloat(speedControl.value)) : MathUtils.degToRad(0.2);
  
  // 默认的按键-关节映射
  const keyMappings = {
    '1': { jointIndex: 0, direction: -1 },
    'q': { jointIndex: 0, direction: 1 },
    '2': { jointIndex: 1, direction: -1 },
    'w': { jointIndex: 1, direction: 1 },
    '3': { jointIndex: 2, direction: 1 },
    'e': { jointIndex: 2, direction: -1 },
    '4': { jointIndex: 3, direction: 1 },
    'r': { jointIndex: 3, direction: -1 },
    '5': { jointIndex: 4, direction: 1 },
    't': { jointIndex: 4, direction: -1 },
    '6': { jointIndex: 5, direction: 1 },
    'y': { jointIndex: 5, direction: -1 },
  };
  
  // 获取机器人实际的关节名称
  const jointNames = robot && robot.joints ? 
    Object.keys(robot.joints).filter(name => robot.joints[name].jointType !== 'fixed') : [];
  console.log('Available joints:', jointNames);
  
  // Function to set the div as active
  const setKeyboardSectionActive = () => {
    if (keyboardControlSection) {
      keyboardControlSection.classList.add('control-active');
      
      // Clear existing timeout if any
      if (keyboardActiveTimeout) {
        clearTimeout(keyboardActiveTimeout);
      }
      
      // Set timeout to remove the active class after 2 seconds of inactivity
      keyboardActiveTimeout = setTimeout(() => {
        keyboardControlSection.classList.remove('control-active');
      }, 2000);
    }
  };
  
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    keyState[key] = true;
    
    // Add visual styling to show pressed key
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    if (keyElement) {
      keyElement.classList.add('key-pressed');
      
      // Highlight the keyboard control section
      setKeyboardSectionActive();
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    keyState[key] = false;
    
    // Remove visual styling when key is released
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    if (keyElement) {
      keyElement.classList.remove('key-pressed');
    }
  });

  // 添加速度控制功能
  if (speedControl) {
    speedControl.addEventListener('input', (e) => {
      // 从滑块获取值 (0.5 到 10)，然后转换为弧度
      const speedFactor = parseFloat(e.target.value);
      stepSize = MathUtils.degToRad(speedFactor);
      
      // 更新速度显示
      const speedDisplay = document.getElementById('speedValue');
      if (speedDisplay) {
        speedDisplay.textContent = speedFactor.toFixed(1);
      }
    });
  }

  function updateJoints() {
    if (controlMode !== 'keyboard') return; // Only update if in keyboard mode
    if (!robot || !robot.joints) return;

    let keyPressed = false;

    // 处理每个按键映射
    Object.keys(keyState).forEach(key => {
      if (keyState[key] && keyMappings[key]) {
        keyPressed = true;
        const { jointIndex, direction } = keyMappings[key];
        
        // 根据索引获取关节名称（如果可用）
        if (jointIndex < jointNames.length) {
          const jointName = jointNames[jointIndex];
          
          // 检查关节是否存在于机器人中
          if (robot.joints[jointName]) {
            // 获取当前关节值
            const currentValue = robot.joints[jointName].angle;
            // 计算新的关节值
            const newValue = currentValue + direction * stepSize;
            
            // 检查是否超出关节限制
            if (!isJointWithinLimits(robot.joints[jointName], newValue)) {
              console.warn(`Joint ${jointName} would exceed its limits. Movement prevented.`);
              // 显示虚拟关节限位提醒
              showAlert('joint', `Joint ${jointName} has reached its limit!`);
              return; // 跳过这个关节的更新
            }
            
            // 直接更新虚拟关节
            robot.joints[jointName].setJointValue(newValue);
          }
        }
      }
    });

    // If any key is pressed, set the keyboard section as active
    if (keyPressed) {
      setKeyboardSectionActive();
    }

    // 更新机器人
    if (robot.updateMatrixWorld) {
      robot.updateMatrixWorld(true);
    }
  }

  // 返回更新函数，以便可以在渲染循环中调用
  return updateJoints;
}

/**
 * 设置控制面板UI
 */
export function setupControlPanel() {
  // Attempt to connect to the WebSocket server when the control panel is set up.
  // connectWebSocket();

  const controlPanel = document.getElementById('controlPanel');
  const togglePanel = document.getElementById('togglePanel');
  const hideControls = document.getElementById('hideControls');

  // 处理折叠/展开控制面板
  if (hideControls) {
    hideControls.addEventListener('click', () => {
      controlPanel.style.display = 'none';
      togglePanel.style.display = 'block';
    });
  }

  if (togglePanel) {
    togglePanel.addEventListener('click', () => {
      controlPanel.style.display = 'block';
      togglePanel.style.display = 'none';
    });
  }

  // 初始化速度显示
  const speedDisplay = document.getElementById('speedValue');
  const speedControl = document.getElementById('speedControl');
  if (speedDisplay && speedControl) {
    speedDisplay.textContent = speedControl.value;
  }
  
  // 设置可折叠部分的逻辑
  setupCollapsibleSections();


  
  // Joycon和VR连接按钮的占位处理（未来实现）
  const connectJoyconButton = document.getElementById('connectJoycon');
  if (connectJoyconButton) {
    connectJoyconButton.addEventListener('click', () => {
      console.log('Joycon connection not yet implemented');
      alert('Joycon connection will be implemented in the future.');
    });
  }
  
  const connectVRButton = document.getElementById('connectVR');
  if (connectVRButton) {
    connectVRButton.addEventListener('click', () => {
      console.log('VR connection not yet implemented');
      alert('VR connection will be implemented in the future.');
    });
  }
}

/**
 * 设置可折叠部分的功能
 */
function setupCollapsibleSections() {
  // 获取所有可折叠部分的标头
  const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
  
  collapsibleHeaders.forEach(header => {
    header.addEventListener('click', () => {
      // 切换当前可折叠部分的打开/关闭状态
      const section = header.parentElement;
      section.classList.toggle('open');
    });
  });
}