## 使用文档

### 1. 环境要求
| 工具    | 版本要求     | 说明                       |
| ------- | ------------ | -------------------------- |
| Node.js | v18.18.1     | 项目运行基础环境           |
| npm     | npm 9.8.1+   | 包管理工具                 |
| pnpm    | pnpm 10.13.1 | 包管理工具（使用pnpm启动） |

### 2. 项目部署步骤
```bash
# 1. 克隆项目代码
git clone git@github.com:Va-s/-.git

# 2. 进入项目目录
cd genki-arm-simulator

# 3. 安装依赖（使用pnpm速度更快）
pnpm install

# 4. 启动开发服务器（本地预览）
pnpm run dev
```
### 3. 项目结构说明
```tree
genki-arm-simulator/
├── node_modules/                # 项目依赖包目录（自动生成）
├── public/                      # 静态资源目录
│   ├── example-robot-data-master/ # 示例机器人数据
│   └── URDF/                    # URDF机器人模型核心目录
│       ├── meshes/ #机器人3D模型文件目录
|	    ├── urdf_files_dataset-main/ #机器人3D模型文件目录
│       └── genkiarm.urdf        # 机器人结构描述文件（关节/部件关联）
├── .gitignore                   # Git版本控制忽略配置
├── index.html                   # 主HTML文件（Three.js渲染入口）
├── index.js                     # 主JS文件（场景初始化、渲染循环）
├── package-lock.json            # npm依赖锁定文件
├── package.json                 # 项目配置和依赖清单
├── pnpm-lock.yaml               # pnpm依赖锁定文件
├── README.md                    # 项目说明文档
├── robotConfig.js               # 机器人配置参数
├── robotControls.js             # 机器人控制逻辑（键盘/面板控制）
├── vercel.json                  # Vercel部署配置
└── vite.config.js               # Vite构建工具配置
```

> #### 1. 更换机器人模型（外观）
>
> 1. **获取模型文件**：从 `public/example-robot-data-master/ or public/urdf_files_dataset-main/ ` 中获取示例 `.stl` 文件，或准备自定义 `.stl` 模型；
> 2. **放置模型**：将 `.stl` 文件放入 `public/URDF/meshes/` 目录；
> 3. **关联模型**：编辑 `public/URDF/genkiarm.urdf`，找到对应部件的 `<mesh>` 标签，修改 `filename` 为新模型路径（例：`meshes/new_part.stl`）；
> 4. **生效**：重启开发服务器（`pnpm run dev`）即可看到新模型。
>
> #### 2. 调整关节参数（运动范围）
>
> 1. 打开 `robotConfig.js`，找到对应关节的配置项；
> 2. 修改 `lowerLimit`（下限）和 `upperLimit`（上限）参数；
> 3. 保存后无需重启，页面会自动更新生效。