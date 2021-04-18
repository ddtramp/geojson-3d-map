import * as d3 from 'd3-geo';

const THREE = window.THREE;

// 初始化一个场景
export default class ThreeMap {
  constructor(set) {
    this.mapData = set.mapData;
    this.color = '#006de0';
    this.init();
  }

  /**
   * @desc 初始化场景
   */
  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(10, window.innerWidth / window.innerHeight, 1, 2000);

    this.setCamera({ x: 150, y: 0, z: 150 });
    this.setLight();
    this.setRender();

    this.setHelper();

    this.loadFont(() => {
      this.drawMap();
    });


    this.setControl();
    this.animate();

    document.body.addEventListener('click', this.mouseEvent.bind(this), { passive: false });
  }

  /**
   * @desc 鼠标事件处理
   */
  mouseEvent(event) {
    if (!this.raycaster) {
      this.raycaster = new THREE.Raycaster();
    }
    if (!this.mouse) {
      this.mouse = new THREE.Vector2();
    }
    if (!this.meshes) {
      this.meshes = [];
      this.group.children.forEach(g => {
        g.children.forEach(mesh => {
          this.meshes.push(mesh);
        });
      });
    }

    // 将鼠标位置归一化为设备坐标。x 和 y 方向的取值范围是 (-1 to +1)
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // 通过摄像机和鼠标位置更新射线
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // 计算物体和射线的焦点
    const intersects = this.raycaster.intersectObjects(this.meshes);
    if (intersects.length > 0) {
      this.clickFunction(event, intersects[0].object.parent);
    }
  }

  /**
   * @desc 设置区域颜色
   */
  setAreaColor(g, color = '#ff0') {
    // 恢复颜色
    g.parent.children.forEach(gs => {
      gs.children.forEach(mesh => {
        mesh.material.color.set(this.color);
      });
    });

    // 设置颜色
    g.children.forEach(mesh => {
      mesh.material.color.set(color);
    });
  }

  /**
   * @desc 绑定事件
   */
  on(eventName, func) {
    if (eventName === 'click') {
      this.clickFunction = func;
    }
  }

  /**
   * @desc 绘制地图
   */
  drawMap() {
    console.log(this.mapData);
    if (!this.mapData) {
      console.error('this.mapData 数据不能是null');
      return;
    }
    // 把经纬度转换成x,y,z 坐标
    this.mapData.features.forEach(d => {
      d.vector3 = [];
      d.properties.vector3 = this.lnglatToMector(d.properties.cp);
      d.geometry.coordinates.forEach((coordinates, i) => {
        d.vector3[i] = [];
        coordinates.forEach((c, j) => {
          if (c[0] instanceof Array) {
            d.vector3[i][j] = [];
            c.forEach(cinner => {
              let cp = this.lnglatToMector(cinner);
              d.vector3[i][j].push(cp);
            });
          } else {
            let cp = this.lnglatToMector(c);
            d.vector3[i].push(cp);
          }
        });
      });
    });

    console.log(this.mapData);

    // 绘制地图模型
    const group = new THREE.Group();
    const lineGroup = new THREE.Group();
    const textGroup = new THREE.Group();

    this.mapData.features.forEach(d => {
      const g = new THREE.Group(); // 用于存放每个地图模块。||省份
      const text = this.createText(d.properties.name, d.properties.vector3);
      g.data = d;
      d.vector3.forEach(points => {
        // 多个面
        if (points[0][0] instanceof Array) {
          points.forEach(p => {
            const mesh = this.drawModel(p);
            const lineMesh = this.drawLine(p);
            lineGroup.add(lineMesh);
            g.add(mesh);
          });
        } else {
          // 单个面
          const mesh = this.drawModel(points);
          const lineMesh = this.drawLine(points);
          lineGroup.add(lineMesh);
          g.add(mesh);
        }
      });
      group.add(g);
      textGroup.add(text);
    });
    this.group = group; // 丢到全局去
    const lineGroupBottom = lineGroup.clone();
    lineGroupBottom.position.z = -2;
    this.scene.add(lineGroup);
    this.scene.add(lineGroupBottom);
    this.scene.add(group);
    this.scene.add(textGroup);

  }

  /**
   * @desc 绘制线条
   * @param {} points
   */
  drawLine(points) {
    const material = new THREE.LineBasicMaterial({
      color: '#ccc',
      transparent: true,
      opacity: 0.7
    });
    const geometry = new THREE.Geometry();
    points.forEach(d => {
      const [x, y, z] = d;
      geometry.vertices.push(new THREE.Vector3(x, y, z + 0.1));
    });
    const line = new THREE.Line(geometry, material);
    return line;
  }

  /**
   * @desc 绘制地图模型 points 是一个二维数组 [[x,y], [x,y], [x,y]]
   */
  drawModel(points) {
    const shape = new THREE.Shape();
    points.forEach((d, i) => {
      const [x, y] = d;
      if (i === 0) {
        shape.moveTo(x, y);
      } else if (i === points.length - 1) {
        shape.quadraticCurveTo(x, y, x, y);
      } else {
        shape.lineTo(x, y, x, y);
      }
    });

    const geometry = new THREE.ExtrudeGeometry(shape, {
      amount: -2,
      bevelEnabled: false
    });
    const material = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    return mesh;
  }

  /**
   * @desc 经纬度转换成墨卡托投影
   * @param {array} 传入经纬度
   * @return array [x,y,z]
   */
  lnglatToMector(lnglat) {
    if (!this.projection) {
      this.projection = d3
        .geoMercator()
        .center([108.904496, 32.668849])
        .scale(80)
        .rotate(Math.PI / 4)
        .translate([0, 0]);
    }
    const [y, x] = this.projection([...lnglat]);
    let z = 0;
    return [x, y, z];
  }


  loadFont(callback = () => {}) { //加载中文字体
    var loader = new THREE.FontLoader();
    var _this = this;
    loader.load('./assets/fonts/chinese.json', function (response) {
      _this.font = response;
      callback && callback();
    });

  }


  createText(name, position) {

    const matLite = new THREE.MeshBasicMaterial( {
      color: 0x006699,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    } );

    const shapes = this.font.generateShapes( name, 100 );

    const geometry = new THREE.ShapeGeometry( shapes );

    geometry.computeBoundingBox();

    const xMid = - 0.5 * ( geometry.boundingBox.max.x - geometry.boundingBox.min.x );

    geometry.translate( xMid, 0, 0 );
    // make shape ( N.B. edge view not visible )

    const text = new THREE.Mesh( geometry, matLite );
    const [x, y, z] = position;
    text.position.set(x, y, z + 0.1);
    text.rotation.x = 0;
    text.rotation.y = 0;
    text.rotation.z = Math.PI / 2;

    
    const SCALE_SIZE = 0.006;
    text.scale.set(SCALE_SIZE, SCALE_SIZE, SCALE_SIZE);

    return text;
  }
  
  /**
   * @desc 动画
   */
  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // required if controls.enableDamping or controls.autoRotate are set to true
    this.controls.update();

    this.renderer.render(this.scene, this.camera);

    this.doAnimate && this.doAnimate.bind(this)();
  }

  /**
   * @desc 设置控制器
   */
  setControl() {
    this.controls = new THREE.OrbitControls(this.camera);
    this.controls.update();
  }

  /**
   * @desc 相机
   */
  setCamera(set) {
    const { x, y, z } = set;
    this.camera.up.x = 0;
    this.camera.up.y = 0;
    this.camera.up.z = 1;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * @desc 设置光线
   */
  setLight() {
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.scene.add(directionalLight);
  }

  /**
   * @desc 设置渲染器
   */
  setRender() {
    this.renderer = new THREE.WebGLRenderer({antialias: true});
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);
  }

  /**
   * @desc 设置参考线
   */
  setHelper() {
    const axesHelper = new THREE.AxisHelper(5);
    this.scene.add(axesHelper);
  }
}
