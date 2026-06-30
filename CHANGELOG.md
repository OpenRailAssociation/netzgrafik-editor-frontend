# Changelog

## [2.12.0](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-editor-frontend-v2.11.1...netzgrafik-editor-frontend-v2.12.0) (2026-06-30)


### Features

* add strict Content-Security-Policy for standalone mode ([ea5611f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/ea5611fb9d0e51f4235bb8e08db140a65e9ab936))
* **service:** emit on filterChanged() ([41b4416](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/41b441639839992879e8735fd76c901e592def10))
* **service:** emit operation when OrderingAlgorithm changed ([d0e0bac](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d0e0bac44ac22abe8b433b518eb8319a381528c3))
* ship type definitions in NPM package ([b49d217](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b49d21771e8e2625981df04859fa98c119a0cccd))
* **view:** enable full name display instead of short name in editor-main-view ([36ba033](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/36ba0336d376ef5af88b9674024f259ae658f82f))
* **view:** enable full name display instead of short name in perlenkette ([2d7a897](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/2d7a8977ca29ddd41e7c757bfbaed99b4ad19393))
* **view:** enable full name display instead of short name in streckengrafik ([f3e2311](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f3e2311a07d89f3eb9144ec0a19d9cde724e1e5d))
* **view:** enable full name display instead of short name od-matrix ([4cc9018](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/4cc9018965b2ee32bda58ddd9430f1e9f06b7cd1))


### Bug Fixes

* **editor-main-view:** clear all objects when loading new DTO ([0e1265c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0e1265c15b03fe953319df39a533dd425463302f))
* Ensure that only correct/valid (feasible) connections gets added ([#1025](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1025)) ([3914bf6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3914bf661f7890146bac41358353583100fffeea))
* **model:** initialize potential missing TrainrunSection.path ([03279fe](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/03279fee25eef01a28bb3f597691fa096f34c4c0))
* orders ports facing ordered neighbors first ([33c2418](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/33c2418b9418952179226f1838761a56a0518818))
* orders transition & free-end ports separately ([d636f67](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d636f67bd036135ce5451dd49f2db243dc7aa083))
* Origin-destination-view reset (init) fixed when filter, color , value changed ([#1113](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1113)) ([0646eb7](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0646eb7d5aa62191834cdf9cc76183d5535d4c50))
* **service:** correctly instantiate TrainrunSection when coming from 3rd party ([a177ad4](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a177ad4137d534adb614b8a487a844e88890c48e))
* **service:** drag transition travel times ([a7e75f5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a7e75f5b9f30d95740a356abb3eb202beb02e72f))
* **service:** missing  in trainrun updates ([d0b57af](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d0b57af2464ad79f2cb802437687fc9afa3df934))
* **service:** missing initPortOrdering after node deletion ([1696825](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/16968258c3d8c0731911bfbdf72f9c70e169f592))
* **service:** missing initPortOrdering after trainrun deletion ([3c1b288](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3c1b2880d5c3362bc6e3f36beacc4dc0eeb67a55))
* **service:** missing initPortOrdering after trainrun duplication ([3a71747](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3a717475042cc8b8c53bb011d58cc3bcec1e0ab1))
* **service:** missing initPortOrdering after trainrunSection creation ([ca42cff](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/ca42cffc903867a5d688b4517c837776c2fba1ae))
* **service:** missing initPortOrdering after trainrunSection deletion ([00edded](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/00edded6e4ff5860e1b246602e32818043fb1e23))
* **service:** wrong travelTime and backwardTravelTime positions (overlapping) ([2d4793a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/2d4793adf5207c1182986b422491901b2767c7f6))
* special case added (handled) ([#1033](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1033)) ([a7ef5bf](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a7ef5bf6c1f622d3299126160d2ef683c3c5b95d))
* trainrun and trainrunSection (eg. times) update trigger redraw ([#1114](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/1114)) ([0106848](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0106848f5c9152663b0fba0890b94a894ace2ef1))
* **view:** don't use attr() to set js executing attributes ([0b61263](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0b61263dcb8e254613320bf1698a5e586c91a08f))
* **view:** fullname display on tip ([3118c0d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3118c0d69fb93098e1774b06fdeab95a0225c5d9))

## [2.11.1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-editor-frontend-v2.11.0...netzgrafik-editor-frontend-v2.11.1) (2026-05-18)


### Bug Fixes

* **ci:** switch to actions/upload-pages-artifact for GitHub Pages ([c222d06](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c222d06749e4e08a177290f5555485eaa53455cd))

## [2.11.0](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-editor-frontend-v2.10.19...netzgrafik-editor-frontend-v2.11.0) (2026-05-18)


### Features

* add port ordering algorithm to minimize crossings ([143a7a7](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/143a7a7daef9f2e63acd7820aa1fed157a41c40c))
* display origin-destination matrix ([403b23b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/403b23bf2c862444e7ad7c8e17fd3f94a9a4a97a))
* display origin-destination matrix ([09a43cd](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/09a43cdfc96038d88027aa74a8479886d3f4c25b))
* Drag drop reroute multi sections ([#633](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/633)) ([0f9e567](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0f9e567980a898fa138b88378f3d08dcfee0e382))
* **editor-main-view:** add asymmetric trainrun filter ([6335012](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/633501254965b6383716005a741495a43611d32c))
* **editor-main-view:** add asymmetry arrow filter ([d31174d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d31174d07f61b938bd17f49fb064d011c46a9f7e))
* **editor-main-view:** add backward travel time filter ([e7f7cee](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/e7f7cee4b31592a3f523fa450edf6eedb0800ad3))
* **editor-main-view:** display backward travel time ([9775e66](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/9775e661e7cf486852e9de1ceb724b45968dddc0))
* **editor-main-view:** introduce asymmetry arrow ([c820912](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c820912f9f166334d9a1f2ac1279e783bef8cc7e))
* integrate new port ordering into UI ([#635](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/635)) ([87cf7cb](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/87cf7cb9396eeb428e8ef818fbb01597ff26e5a1))
* **models:** add helpers to Port and Transition ([a395aed](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a395aed1edc845ded1cb6145a203c8ab7a07336d))
* **perlenkette:** add asymmetry support ([f8cace1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f8cace14b67259a2c2d44673b2afb2bd4d1fb6cb))
* **services:** add asymmetry support to propagateTrainrunSectionTime() ([37c1ee5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/37c1ee5c1db8367380e0e42c0c646b0cc0fc9276))
* **traffic-side:** add traffic side configuration in editor properties ([0287cc7](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0287cc7833fe93a48e28d55fbf48a0efcc883bdb))
* **traffic-side:** update netzgrafik dto ([efca965](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/efca965a1b29bc8f49ed1fd1a385d2e7e416efb9))
* **traffic-side:** update traffic side in views ([336c4bc](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/336c4bcb22f78261bb58562db45afb9e643b7d73))
* **view:** add symmetry switches to section tab in trainrun dialog ([6a0cdff](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6a0cdff55948bd18e8b58bf8e7f746dd18413e54))
* **view:** hide note borders when no mouse over ([7609754](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7609754f2bbe114417e6acc432a5004aff884bd4))


### Bug Fixes

* 260 feature request align selected nodes all at once ([#390](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/390)) ([af03ac9](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/af03ac956543103e9f0604dda75ed498fa6af94d))
* 334 bug archived read mode allows to move nodes but not persisted ([#336](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/336)) ([6275ae1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6275ae17929fbf564b7419896ad11946b90c20b1))
* 346 bug importing 3rd party json misses detecting non stop transitions ([#347](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/347)) ([9d71b4a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/9d71b4aa9608eaec4d50f7f13178693305ea4a3c))
* 350 bug delete node or trainrunsections cause low performance ([#351](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/351)) ([72f8599](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/72f859920ac425668356fcb095f2ef49f019421f))
* Add checks to ensure the trainrun section remains valid in edge cases. ([#793](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/793)) ([b62bb93](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b62bb939666168d9cf94c9bcf4c4142cb97afb53))
* Add extra check for MultiNodeMoving trainrun section   ([#769](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/769)) ([5466655](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/54666558c33c8f2e0cde9b9453817acb9281112f))
* add missing event emitter to node service when duplicating node ([d855e65](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d855e6510d982775f001fb555cd54afc51777c34))
* add missing source arrival in TrainrunSectionViewObject.generateKey() ([8fad923](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8fad923a81129c60dcc08a4724878d7e08797401))
* adding strict null checks for app/data-structures directory ([#657](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/657)) ([b5e3dbb](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b5e3dbbbb93b7df2110580de7b60863be96a2be3))
* address XSS vulnerability with note text ([27ba35c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/27ba35c2d7b1238ebca275e64ad92d889889afd2))
* aemit operations for position transformation service ([#400](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/400)) ([a7dae9e](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a7dae9ef2f71e32238c3015d1ae4165dfd0d7bf8))
* After pusblishing the netzgrafik-editor under the host of OpenRailAssocation there should no longer the old github url in the repo. ([#737](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/737)) ([c3997e6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c3997e682f8799a32577ad815e965160cf9dd1d6))
* Bug `saveSvgAsPng` exports incorrectly when Windows display scaling ≠ 100% fixed ([#563](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/563)) ([6b0dfe8](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6b0dfe8dac3823389defe31b31afed48300bfddd))
* build broken! ([#371](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/371)) ([04f9a2f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/04f9a2fab45b987e352a75f71616e7e1a02a34ac))
* changed filtering oder and add cull for notes ([#429](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/429)) ([b863cda](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b863cda2554e49c5fa6da4d4d53d1a10042eb1e4))
* check strict null from temporary config file instead of package.json ([3fce925](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3fce9251536a9723b99633ac149ce03fa2536479))
* check was missing - the filtering should only be reset when a filter is active and the filtering is not temporary switched off ([#451](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/451)) ([1551417](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1551417d79c3184db82593d84d6ac62f8c7eff95))
* Check/correct missing transition after combine two trainruns ([#767](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/767)) ([5a5e766](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5a5e766f6d091f4517f17987cb53fae8686a58ac))
* Clicking in the background in the Pearl view triggers stop editing ([#566](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/566)) ([6a9de5c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6a9de5c61a2a07aee14aee78dd64fff997a7ad09))
* compute leftToRight per trainrun in Streckengrafik ([#749](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/749)) ([f8469fa](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f8469fa6c9901c1244a6bf1f23b92ff79bff5927))
* compute OD matrix for a full day ([#922](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/922)) ([6939bdd](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6939bdd9e5d80a61c23faa9c2468f4607edb5d01))
* compute OD matrix for a full day ([#922](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/922)) ([6939bdd](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6939bdd9e5d80a61c23faa9c2468f4607edb5d01))
* compute OD matrix for a full day ([#922](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/922)) ([f6e5f7e](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f6e5f7e063f58604258d5f3eead01c5d235e4b8d))
* correct connections-&gt;transfers naming for O/D matrix ([#365](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/365)) ([454c201](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/454c201abf3228dacecb8685f80545ef13eea554))
* CSV base data export  ([#343](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/343)) ([2d75f2d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/2d75f2da23d63a87638bac8ba3f1551f54054b9c))
* documentation for 3rd party import ([#367](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/367)) ([53ee469](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/53ee469b7cbba5042530d6436f1dbfaa447a1285))
* drop duplicate frequency in TrainrunSectionViewObject.generateKey() ([233b0f1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/233b0f1c424b740e1c73e393fa594b19d16c06cd))
* drop extraneous "browser" directory in dist/ ([abd6127](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/abd6127903a7038d13b8ba5f7ffed8fd289d830d))
* drop favicon from standalone index.html ([d25f281](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d25f281ef70a5b9260414b24940ecf344c44f3b7))
* emit single operation in setTimeStructureToTrainrunSections() ([7d85bee](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d85bee5e19417094be395b2720f383c5364c1b4))
* emit trainrun create after creating its sections when duplicating ([58d202e](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/58d202eed988772018deb0ac086194d7ea2b344c))
* emit trainrun create after creating its sections when duplicating ([31115a9](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/31115a93f69599c0caf665796679033792f02527))
* ensure both trainruns have endNodes at "pin" ([#862](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/862)) ([766463c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/766463ce34c849e7e3d0d1e6a659a0ed0e8384a8))
* Ensure the SVG container uses the full - space ([#612](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/612)) ([616b8d2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/616b8d2d2d29c750f757119eeff2b894e9974635))
* Entering a negative value causes incorrect departure/arrival times ([#780](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/780)) ([85fce12](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/85fce12b5268cda5f4dfcf6dc169cdbfeb03e7cf))
* Firefox rendering issue fixed – styling slightly changed ([#548](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/548)) ([d939b84](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d939b84409fb6410f34da2227812aa8810f61605))
* fix metadata operation ([232f2a1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/232f2a14f5a5f14ab0289432e7cc4466d38148fe))
* fix O/D Matrix for trainrun 0 ([#337](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/337)) ([28a6d3a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/28a6d3ae56c436a40e06eed54a3bbc117b97bdb7))
* fix traffic side in editor view ([6ac83d6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6ac83d6a464e39ca8549570dd15b657446728f28))
* fix trains going back in OD matrix ([#395](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/395)) ([173986c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/173986c8b3e140327d45d44d983310709a3541d0))
* for downwards propagation the translation key was wrong ([#630](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/630)) ([46c293c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/46c293c9c9ae49f1bba77511f0379b9ae54f43c7))
* Graphical Timetable (Streckengrafik) – Section Track Estimator Not Working for Train with direction changes ([#614](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/614)) ([a623d3f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a623d3f4cb29a62b48e48ce644d89243ed8c2de6))
* handle potential null values in app/view/themes directory ([1dfb0ac](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1dfb0ac6987e60c05394a5008e2fdcd73e7cd596))
* Highlight entire trainrun when hovering a trainrun section line ([#534](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/534)) ([7785dea](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7785dea05cc4781eca7cd091045ea2ccd5908a44))
* **i18n:** fix missing symmetry translation identifier ([04982f9](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/04982f9d59f368c63807f7fd24dff16ae69f1430))
* **i18n:** zoom out german typo ([158555f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/158555f9d6c0174d3c4ce8830c480d2b2844ddf1))
* if the ctrl + mouse wheel lets scale the netzgrafik or multi-selected nodes (local scale) ([#376](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/376)) ([de55afe](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/de55afe8b1101615c43906c807989be62d84485d))
* If there is in the data a epsilon issue, we just remove it at latest point to ensure the export and rendering looks good ([#622](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/622)) ([6e81f56](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6e81f568da3b75b0f65194b5623778727649c9a6))
* implemented in such a way the ux expert proposed ([#991](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/991)) ([0cc1c9d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0cc1c9dad055b00eb7a7d77babfe8dfe2bd40ade))
* import 3rd party performance ([#373](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/373)) ([5b0ecdc](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5b0ecdc5c9650ed28968871fc9398a65f113962f))
* improve guard initializeWithCurrentNote when note is not yet available ([37a8852](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/37a8852d77562f2dd585717ee6f5b487f9ef9e9d))
* Incorrect Handling of One-Way Train Runs in Track Data Assignment ([#518](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/518)) ([844d351](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/844d351262c95d4d6cc1d072708b1edae2dabc4b))
* issue fixed ([#380](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/380)) ([0bbff36](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0bbff3671cf1d404ae3fa8236be61ca69805f951))
* issue fixed and two other methods refactored to same code structure as the getTrainrunFrequency method ([f60e928](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f60e9287a62171c5ef0619ba9c1e8edc0e9c234a))
* issue fixed and two other methods refactored to same code structure as the getTrainrunFrequency method ([#383](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/383)) ([e864528](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/e864528c3ce6c993edc4eec5e047836cee21c9b4))
* Issue fixed. Styling is now in scss no longer in the typescript ([#627](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/627)) ([93c0d27](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/93c0d27f0a5ed37b35ac0b100d6edfc131f0d3f6))
* **issue_template:** url in pr, issue and bug report template ([0be456d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0be456db453ffc8d742ba0ac46cae37af56eb3e4))
* **json-files:** missing asymmetry, port-ordering and traffic-side migrations ([7d94c0a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d94c0a372b4f9ba988554940527670bb02d4b47))
* just in case the update is faster then the deletion (close window) ([35d79c2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/35d79c25becd19db42219d20055191fe4cf2c633))
* Lock symbol (svg) background rendering issue pearls view ([#704](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/704)) ([8c766e1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8c766e1e098e8b1a4a5e8fa53a5c98749b643419))
* Mouse cursor issue fixed ([#662](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/662)) ([4ca8377](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/4ca8377c0ece96e377572031da39cc92d213b24e))
* multi-nodes scaling ctrl + mouse wheel ([#386](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/386)) ([f393f4a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f393f4add7e0ae05f63d6a20762d3efc266fb0ed))
* Multiply filter change event (signal) triggers when filter panel gets shown  ([#610](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/610)) ([177e0ab](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/177e0abdc0a907d8b2e56fe2d0c29dcad3a329c7))
* Odd times for freq &gt; 60 will be italic rendering in the trainrun-section-card.component ([#865](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/865)) ([15ebe4a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/15ebe4a38f1c31873ec51337aa70a14d6188ef67))
* One way train run arrows are drawn outside of lines when moving node ([#591](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/591)) ([ef671ff](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/ef671ff5a1816a30288f0897ab2f3bc8c2aa148b))
* **operation:** emit trainrun update on time propagation ([01d40b8](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/01d40b86697bb4dc4ff047f7c1aeef12095ac2c7))
* Performance - only render trainrunSection and transition element - which are required ([#444](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/444)) ([4d2ba01](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/4d2ba01c3edfa556aa33ddc2f3eeb58a0c7c1476))
* performance issue fixed (part 2) ([#354](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/354)) ([c8eb613](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c8eb61364b7cf5ab8d41a2a04eba3e9d35c46562))
* performance opt / refactored ([#356](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/356)) ([f939df6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f939df6640159e868802de80f12a40469bf8d943))
* Perlenkette Connection Time display precision fixed ([#863](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/863)) ([9bc89e4](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/9bc89e413ae93c2d74785a6a7e704a6a8cc72fa4))
* **perlenkette:** do not display asymmetry arrow when trainrun is one-way ([23fdd95](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/23fdd954ad4ad3e83a90657efa80188ed3ecb22a))
* Problem fixed and refactored some part. This refactoring fixes a… ([#594](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/594)) ([9acf684](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/9acf684e95dd8f12f9e49e0c6a897a43ed8b9e22))
* problem solved - design addapted to the left / right side-bar ([#639](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/639)) ([30fb09a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/30fb09ad5b057c5569be844f50ef0b8fd95c669d))
* Release-please no with Trusted Publisher NPM ([#728](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/728)) ([42978ce](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/42978cebee21392f5c241cae10731b7c4ef777e0))
* remove undoService.pushCurrentVersion - call … ([#445](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/445)) ([8ba733d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8ba733dd668a2cc546b41ccfc2c24ac7515e80f0))
* Reported issue fixed due of wrong halteZeit (stopping time logic) ([#949](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/949)) ([758dfd4](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/758dfd48e5430f160a320c6b774264f01d4d6d65))
* Reported minus/plus button issue resolved ([#864](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/864)) ([5eed8d2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5eed8d2a8fe8880402ca9364d7ec1beba202987a))
* reset main view after netzgrafikDto import ([c0e2d02](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c0e2d0202e96d1097362b519e274e74c862213be))
* Reset state (subject) when closing the Editor/..View ([#647](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/647)) ([fda7342](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/fda7342e98b976796967796e5fa322545b58f7d5))
* Resource deletion when node gets deleted ([#523](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/523)) ([5d15e60](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5d15e608ca88741635e0a0de3abbd8ccbd0d79b1))
* revert the order change (emit only at the very end) ([b8c7612](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b8c7612ff0999106272fb447724ee6a344c17258))
* Roadmap link ([#512](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/512)) ([27e98ea](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/27e98eac923502f66dfd094c0c03e9febc8a31b8))
* Scale netzgrafik does not include notes ([#616](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/616)) ([240471b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/240471b6652eb96e981dde1c76b3a80ba7e78987))
* Select all nodes/notes with `ctrl + a` no longer ignores active filters ([#766](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/766)) ([8684f4d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8684f4d3faa4a9f81f8d82480ae08c8eb650516f))
* **service:** fix travelTimeOffset for asymmetric trainruns ([7d35c86](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d35c86abe55ee982fcbcd10856ac6639d4d478b))
* **service:** temporary fix for symmetry reset ([c54de5d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c54de5d18ec372e57a4bf9cd8a5b8257acb34382))
* Simplified third-party JSON import (no port alignment/path precalculation required) ([#341](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/341)) ([d7d1776](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d7d1776e7bb9fd4872821d315f9a81a8c2313c4d))
* simplify OD matrices processing (performance) ([7d18cd5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d18cd55aab0abf8796f7236bd8c3a90bf7ed9fa))
* simplify OD matrices processing (performance) ([e9d2e55](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/e9d2e55134ac12b0234c3039e7652db7a9df4b41))
* spin-buttons issue resolved ([#996](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/996)) ([2a1da54](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/2a1da541ef78c34d2756896b439c441bb5e15a27))
* **streckengrafik:** add missing translation key ([1fd41e5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1fd41e5a0a2bdf249bfcb047dcf6828d9e4bcd6d))
* **streckengrafik:** bottom options overflow ([1cdf83f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1cdf83fc41f606dc4af9abd14af155202ef076c7))
* **streckengrafik:** correct arrival time for right-to-left ONE_WAY trains ([#786](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/786)) ([#787](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/787)) ([6f48b7d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6f48b7df03031fb5ddd44c116d0796bc3ba82ccc))
* **streckengrafik:** fix turnaround time for asymmetric trainruns ([f9eb470](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f9eb4704d7ea8a0a497f5fb4cf59ffad5e58651b))
* **streckengrafik:** use proper node for ONE_WAY extremity detection ([#764](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/764)) ([402b5ae](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/402b5ae6146dfea4d496e4ce305bc31f2d712b3f))
* Swap the O/D data ([#856](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/856)) ([049fdb5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/049fdb552b0c7eb61b69edcfec29042c8aa22ba2))
* synch prosemirror-model versions in ngx-editor dependencies ([c4cf303](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c4cf303002b829d9cb2ae8371762c6bbd0ec5534))
* The migration of the third-party import was not correctly performed during the one-way feature implementation. ([#620](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/620)) ([70b46e3](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/70b46e31ef4e48bff57c626d85671fde8718d24a))
* The performance gets improved for big Netzgrafik ([#427](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/427)) ([bb00a4d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/bb00a4d54cded069132d1bbf5b1e7e754af97288))
* There was an issue introduced during refactoring. The problem occurs when the user drags too quickly from left to right: the mouse suddenly leaves the dialog window and loses the drag content. This causes the dragging to get stuck and results in poor UX. ([#642](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/642)) ([5408a97](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5408a97beb9ab85935e0bed2b8fa3a9f55c953d6))
* toggle temporay disable ([#455](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/455)) ([bdede87](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/bdede8730099a92669d4a741a229f8cdd56582cc))
* **traffic side:** fix unwanted overwrite ([f12257d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f12257d0c4988603f2567e597d17b6746273a931))
* Trainrun deselection leaves single trainrun section marked/selected ([#682](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/682)) ([86f7120](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/86f712000a52e5c776663df52cf6935cbe16d286))
* **trainrun:** allows to change direction of cyclic one way trainrun ([a32cacc](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a32cacc90e1f7675e38486ce4c5a23fb1fcd7596))
* **trainrun:** validate that travel time respect timePrecision ([b777e25](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b777e25e24383c2f61ea9a91e8d4a48a697e025a))
* typo 'Serivce' -&gt; 'Service' ([#392](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/392)) ([1d6b811](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1d6b81110c662d3ca1fc01207eb7ab9974b2b9fe))
* update some npm packages  ([#511](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/511)) ([b5caa7d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b5caa7d444613522d63139a753a6c3c704168c90))
* updateTrainrunCategory,      updateTrainrunTimeCategory and     … ([#457](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/457)) ([ee9a0b7](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/ee9a0b7aecdc256784de0b128d5f322c9f2f295e))
* use getDto() in NGE events instead of models ([5b59eee](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5b59eeeaeebe26ec42e230af69326350f4491d22))
* use HashLocationStrategy for standalone mode ([e8a155a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/e8a155ae22578f793f1b325048574c805e097af6))
* **view:** apply border-radius change only to checkbox and not radio buttons ([161e035](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/161e03596824f4a6589d71493b0656c0e849d369))
* **view:** hide one-way arrow around hidden nodes ([731f030](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/731f0303e70e3777ad27f8659fe0d6cee9dba6b7))
* warn users when having unsymmetric times ([#359](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/359)) ([9923567](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/992356722772db594e48a1f7aa8511b904a62c79))
* We have to close the sbb-editor-node-detail-view before deleting the node. Just change the call-order. ([f0f6d7b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f0f6d7b14bc5c9cefec7b9c98a8981685fda7979))
* While combining two trainruns the first trainrun will "survive" and the second one will be deleted. If the trainrun which will be deleted consists of more than one trainrun segment (connected paths) the reported issue will be generated. (Test added) ([c55388b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c55388b2d58efd788d64f745560c4b37c5d227e9))

## [2.10.19](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.18...netzgrafik-frontend-v2.10.19) (2026-03-11)


### Bug Fixes

* ensure both trainruns have endNodes at "pin" ([#862](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/862)) ([766463c](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/766463ce34c849e7e3d0d1e6a659a0ed0e8384a8))

## [2.10.18](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.17...netzgrafik-frontend-v2.10.18) (2026-03-03)


### Bug Fixes

* adding strict null checks for app/data-structures directory ([#657](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/657)) ([b5e3dbb](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b5e3dbbbb93b7df2110580de7b60863be96a2be3))
* Odd times for freq &gt; 60 will be italic rendering in the trainrun-section-card.component ([#865](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/865)) ([15ebe4a](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/15ebe4a38f1c31873ec51337aa70a14d6188ef67))
* Perlenkette Connection Time display precision fixed ([#863](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/863)) ([9bc89e4](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/9bc89e413ae93c2d74785a6a7e704a6a8cc72fa4))
* Reported minus/plus button issue resolved ([#864](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/864)) ([5eed8d2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5eed8d2a8fe8880402ca9364d7ec1beba202987a))

## [2.10.17](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.16...netzgrafik-frontend-v2.10.17) (2026-02-25)


### Bug Fixes

* Swap the O/D data ([#856](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/856)) ([049fdb5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/049fdb552b0c7eb61b69edcfec29042c8aa22ba2))

## [2.10.16](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.15...netzgrafik-frontend-v2.10.16) (2026-02-24)


### Bug Fixes

* **i18n:** zoom out german typo ([158555f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/158555f9d6c0174d3c4ce8830c480d2b2844ddf1))
* **trainrun:** allows to change direction of cyclic one way trainrun ([a32cacc](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/a32cacc90e1f7675e38486ce4c5a23fb1fcd7596))
* **trainrun:** validate that travel time respect timePrecision ([b777e25](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b777e25e24383c2f61ea9a91e8d4a48a697e025a))

## [2.10.15](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.14...netzgrafik-frontend-v2.10.15) (2026-02-17)


### Bug Fixes

* synch prosemirror-model versions in ngx-editor dependencies ([c4cf303](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c4cf303002b829d9cb2ae8371762c6bbd0ec5534))

## [2.10.14](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.13...netzgrafik-frontend-v2.10.14) (2026-01-30)


### Bug Fixes

* Add checks to ensure the trainrun section remains valid in edge cases. ([#793](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/793)) ([b62bb93](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b62bb939666168d9cf94c9bcf4c4142cb97afb53))

## [2.10.13](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.12...netzgrafik-frontend-v2.10.13) (2026-01-27)


### Bug Fixes

* Entering a negative value causes incorrect departure/arrival times ([#780](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/780)) ([85fce12](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/85fce12b5268cda5f4dfcf6dc169cdbfeb03e7cf))

## [2.10.12](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.11...netzgrafik-frontend-v2.10.12) (2026-01-27)


### Bug Fixes

* Add extra check for MultiNodeMoving trainrun section   ([#769](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/769)) ([5466655](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/54666558c33c8f2e0cde9b9453817acb9281112f))
* **streckengrafik:** correct arrival time for right-to-left ONE_WAY trains ([#786](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/786)) ([#787](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/787)) ([6f48b7d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/6f48b7df03031fb5ddd44c116d0796bc3ba82ccc))
* **streckengrafik:** use proper node for ONE_WAY extremity detection ([#764](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/764)) ([402b5ae](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/402b5ae6146dfea4d496e4ce305bc31f2d712b3f))

## [2.10.11](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.10...netzgrafik-frontend-v2.10.11) (2026-01-20)


### Bug Fixes

* Check/correct missing transition after combine two trainruns ([#767](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/767)) ([5a5e766](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5a5e766f6d091f4517f17987cb53fae8686a58ac))
* **issue_template:** url in pr, issue and bug report template ([0be456d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/0be456db453ffc8d742ba0ac46cae37af56eb3e4))
* Select all nodes/notes with `ctrl + a` no longer ignores active filters ([#766](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/766)) ([8684f4d](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8684f4d3faa4a9f81f8d82480ae08c8eb650516f))

## [2.10.10](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.9...netzgrafik-frontend-v2.10.10) (2026-01-19)


### Bug Fixes

* **streckengrafik:** add missing translation key ([1fd41e5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1fd41e5a0a2bdf249bfcb047dcf6828d9e4bcd6d))
* **streckengrafik:** bottom options overflow ([1cdf83f](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1cdf83fc41f606dc4af9abd14af155202ef076c7))

## [2.10.9](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.8...netzgrafik-frontend-v2.10.9) (2026-01-19)


### Bug Fixes

* compute leftToRight per trainrun in Streckengrafik ([#749](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/749)) ([f8469fa](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f8469fa6c9901c1244a6bf1f23b92ff79bff5927))
* emit single operation in setTimeStructureToTrainrunSections() ([7d85bee](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d85bee5e19417094be395b2720f383c5364c1b4))

## [2.10.8](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.7...netzgrafik-frontend-v2.10.8) (2026-01-08)


### Bug Fixes

* After pusblishing the netzgrafik-editor under the host of OpenRailAssocation there should no longer the old github url in the repo. ([#737](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/737)) ([c3997e6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/c3997e682f8799a32577ad815e965160cf9dd1d6))

## [2.10.7](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.6...netzgrafik-frontend-v2.10.7) (2026-01-07)


### Bug Fixes

* emit trainrun create after creating its sections when duplicating ([58d202e](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/58d202eed988772018deb0ac086194d7ea2b344c))

## [2.10.6](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.5...netzgrafik-frontend-v2.10.6) (2026-01-06)


### Bug Fixes

* Release-please no with Trusted Publisher NPM ([#728](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/728)) ([42978ce](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/42978cebee21392f5c241cae10731b7c4ef777e0))

## [2.10.5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.4...netzgrafik-frontend-v2.10.5) (2026-01-05)


### Bug Fixes

* add missing source arrival in TrainrunSectionViewObject.generateKey() ([8fad923](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8fad923a81129c60dcc08a4724878d7e08797401))
* drop duplicate frequency in TrainrunSectionViewObject.generateKey() ([233b0f1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/233b0f1c424b740e1c73e393fa594b19d16c06cd))

## [2.10.4](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.3...netzgrafik-frontend-v2.10.4) (2025-12-22)


### Bug Fixes

* check strict null from temporary config file instead of package.json ([3fce925](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/3fce9251536a9723b99633ac149ce03fa2536479))
* handle potential null values in app/view/themes directory ([1dfb0ac](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/1dfb0ac6987e60c05394a5008e2fdcd73e7cd596))

## [2.10.3](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.2...netzgrafik-frontend-v2.10.3) (2025-12-21)


### Bug Fixes

* Lock symbol (svg) background rendering issue pearls view ([#704](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/704)) ([8c766e1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/8c766e1e098e8b1a4a5e8fa53a5c98749b643419))
* use getDto() in NGE events instead of models ([5b59eee](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/5b59eeeaeebe26ec42e230af69326350f4491d22))

## [2.10.2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.1...netzgrafik-frontend-v2.10.2) (2025-12-11)


### Bug Fixes

* Trainrun deselection leaves single trainrun section marked/selected ([#682](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/682)) ([86f7120](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/86f712000a52e5c776663df52cf6935cbe16d286))

## [2.10.1](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.10.0...netzgrafik-frontend-v2.10.1) (2025-12-05)

### Bug Fixes

- Mouse cursor issue fixed ([#662](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/662)) ([4ca8377](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/4ca8377c0ece96e377572031da39cc92d213b24e))

## [2.10.0](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.29...netzgrafik-frontend-v2.10.0) (2025-11-27)

### Features

#### Origin-Destination Matrix

- Display origin-destination matrix ([403b23b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/403b23bf2c862444e7ad7c8e17fd3f94a9a4a97a), [09a43cd](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/09a43cdfc96038d88027aa74a8479886d3f4c25b))
- Simplified OD matrix processing for better performance ([7d18cd5](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/7d18cd55aab0abf8796f7236bd8c3a90bf7ed9fa), [e9d2e55](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/e9d2e55134ac12b0234c3039e7652db7a9df4b41))
- O/D Matrix container now dynamic (full width/height) ([#611](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/611))
- O/D Matrix variant switching corrected ([#632](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/632))
- Dark mode O/D Matrix tooltip CSS fixed ([#626](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/626))
- Removed epsilon issues in data to ensure clean export and rendering ([#622](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/622))
- Ensure SVG container uses full space ([#612](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/612))

#### Graphical Timetable (Streckengrafik)

- Section Track Estimator now works for trains with direction changes ([#614](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/614))
- Performance optimisation implemented ([#553](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/553))
- Sidebar design adapted for left/right layout ([#639](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/639))
- Highlight entire trainrun when hovering a trainrun section line ([#534](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/534))
- Scale netzgrafik does not include notes ([#616](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/616))

### Bug Fixes

#### Trainrun & One-Way Handling

- Correct handling of one-way train runs in track data assignment ([#517](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/517)) ([844d351](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/844d351262c95d4d6cc1d072708b1edae2dabc4b))
- Combine two one-way train runs no longer leads to mixed-up directions ([#525](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/525))
- One-way train run arrows alignment fixed when moving nodes ([#591](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/591)) ([ef671ff](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/ef671ff5a1816a30288f0897ab2f3bc8c2aa148b))
- Incorrect train shown in one-way subview after deselection/reselection fixed ([#593](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/593))
- Wrong origin-destination matrix calculation for one-way train runs fixed ([#520](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/520))
- Replace ⋮ by ⟷ for one-way components ([#555](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/555))
- Migration of third-party import corrected during one-way feature implementation ([#620](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/620))
- Refactoring fixes for one-way train run handling ([#594](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/594))

#### Pearl View

- Clicking the background now correctly stops editing ([#565](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/565), [#566](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/566))
- Missing German/French/English translation for backward propagation fixed ([#629](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/629))
- Wrong translation key for downward propagation fixed ([#630](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/630))

#### Export & Rendering

- Fixed `saveSvgAsPng` export issue when Windows display scaling ≠ 100% ([#563](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/563))
- Export features (PNG/SVG) corrected ([#470](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/470))
- Firefox rendering issue fixed – styling slightly adjusted ([#548](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/548))

#### Editor & Node Handling

- Added missing event emitter to node service when duplicating a node ([d855e65](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/d855e6510d982775f001fb555cd54afc51777c34))
- Resource deletion when node is removed ([#523](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/523))
- Close node detail view before deleting node ([f0f6d7b](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/f0f6d7b14bc5c9cefec7b9c98a8981685fda7979))
- Drag-and-drop reroute for multiple sections ([#633](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/633))
- Split/Fuse trainrun sections with node / remove node ([#638](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/638))
- Reset state when closing the Editor view ([#647](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/647))
- Fixed deletion error when removing node from side view ([#544](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/544))
- Fixed deletion order issue (close window faster than update) ([35d79c2](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/35d79c25becd19db42219d20055191fe4cf2c633))

#### General Improvements

- Improved guard `initializeWithCurrentNote` when note is not yet available ([37a8852](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/37a8852d77562f2dd585717ee6f5b487f9ef9e9d))
- Styling moved from TypeScript to SCSS ([#627](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/627))
- Updated roadmap link ([#512](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/512))
- Updated npm packages ([#511](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/511))
- Fixed drag issue when moving too quickly across dialog window ([#642](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/642))
- Reverted order change (emit only at the very end) ([b8c7612](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/commit/b8c7612ff0999106272fb447724ee6a344c17258))
- Multiple filter change events no longer trigger when filter panel is shown ([#610](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/610))
- Long trainrun names no longer break close button in dialog ([#646](https://github.com/OpenRailAssociation/netzgrafik-editor-frontend/issues/646))

## [2.9.29](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.28...netzgrafik-frontend-v2.9.29) (2025-05-13)

### Bug Fixes

- updateTrainrunCategory, updateTrainrunTimeCategory and … ([#457](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/457)) ([ee9a0b7](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/ee9a0b7aecdc256784de0b128d5f322c9f2f295e))

## [2.9.28](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.27...netzgrafik-frontend-v2.9.28) (2025-05-12)

### Bug Fixes

- toggle temporay disable ([#455](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/455)) ([bdede87](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/bdede8730099a92669d4a741a229f8cdd56582cc))

## [2.9.27](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.26...netzgrafik-frontend-v2.9.27) (2025-05-12)

### Bug Fixes

- check was missing - the filtering should only be reset when a filter is active and the filtering is not temporary switched off ([#451](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/451)) ([1551417](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1551417d79c3184db82593d84d6ac62f8c7eff95))

## [2.9.26](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.25...netzgrafik-frontend-v2.9.26) (2025-05-09)

### Bug Fixes

- Performance - only render trainrunSection and transition element - which are required ([#444](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/444)) ([4d2ba01](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/4d2ba01c3edfa556aa33ddc2f3eeb58a0c7c1476))

## [2.9.25](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.24...netzgrafik-frontend-v2.9.25) (2025-05-08)

### Bug Fixes

- remove undoService.pushCurrentVersion - call … ([#445](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/445)) ([8ba733d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/8ba733dd668a2cc546b41ccfc2c24ac7515e80f0))

## [2.9.24](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.23...netzgrafik-frontend-v2.9.24) (2025-04-09)

### Bug Fixes

- reset main view after netzgrafikDto import ([c0e2d02](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/c0e2d0202e96d1097362b519e274e74c862213be))

## [2.9.23](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.22...netzgrafik-frontend-v2.9.23) (2025-04-03)

### Bug Fixes

- changed filtering oder and add cull for notes ([#429](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/429)) ([b863cda](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/b863cda2554e49c5fa6da4d4d53d1a10042eb1e4))

## [2.9.22](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.21...netzgrafik-frontend-v2.9.22) (2025-04-01)

### Bug Fixes

- The performance gets improved for big Netzgrafik ([#427](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/427)) ([bb00a4d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/bb00a4d54cded069132d1bbf5b1e7e754af97288))

## [2.9.21](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.20...netzgrafik-frontend-v2.9.21) (2025-01-28)

### Bug Fixes

- aemit operations for position transformation service ([#400](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/400)) ([a7dae9e](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/a7dae9ef2f71e32238c3015d1ae4165dfd0d7bf8))

## [2.9.20](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.19...netzgrafik-frontend-v2.9.20) (2025-01-15)

### Bug Fixes

- fix trains going back in OD matrix ([#395](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/395)) ([173986c](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/173986c8b3e140327d45d44d983310709a3541d0))

## [2.9.19](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.18...netzgrafik-frontend-v2.9.19) (2024-12-18)

### Bug Fixes

- typo 'Serivce' -&gt; 'Service' ([#392](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/392)) ([1d6b811](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1d6b81110c662d3ca1fc01207eb7ab9974b2b9fe))

## [2.9.18](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.17...netzgrafik-frontend-v2.9.18) (2024-12-17)

### Bug Fixes

- 260 feature request align selected nodes all at once ([#390](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/390)) ([af03ac9](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/af03ac956543103e9f0604dda75ed498fa6af94d))

## [2.9.17](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.16...netzgrafik-frontend-v2.9.17) (2024-12-12)

### Bug Fixes

- multi-nodes scaling ctrl + mouse wheel ([#386](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/386)) ([f393f4a](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f393f4add7e0ae05f63d6a20762d3efc266fb0ed))

## [2.9.16](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.15...netzgrafik-frontend-v2.9.16) (2024-12-12)

### Bug Fixes

- issue fixed and two other methods refactored to same code structure as the getTrainrunFrequency method ([#383](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/383)) ([e864528](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e864528c3ce6c993edc4eec5e047836cee21c9b4))

## [2.9.15](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.14...netzgrafik-frontend-v2.9.15) (2024-12-11)

### Bug Fixes

- issue fixed ([#380](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/380)) ([0bbff36](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/0bbff3671cf1d404ae3fa8236be61ca69805f951))

## [2.9.14](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.13...netzgrafik-frontend-v2.9.14) (2024-12-11)

### Bug Fixes

- if the ctrl + mouse wheel lets scale the netzgrafik or multi-selected nodes (local scale) ([#376](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/376)) ([de55afe](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/de55afe8b1101615c43906c807989be62d84485d))

## [2.9.13](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.12...netzgrafik-frontend-v2.9.13) (2024-12-10)

### Bug Fixes

- import 3rd party performance ([#373](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/373)) ([5b0ecdc](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/5b0ecdc5c9650ed28968871fc9398a65f113962f))

## [2.9.12](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.11...netzgrafik-frontend-v2.9.12) (2024-12-05)

### Bug Fixes

- build broken! ([#371](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/371)) ([04f9a2f](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/04f9a2fab45b987e352a75f71616e7e1a02a34ac))

## [2.9.11](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.10...netzgrafik-frontend-v2.9.11) (2024-11-28)

### Bug Fixes

- correct connections-&gt;transfers naming for O/D matrix ([#365](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/365)) ([454c201](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/454c201abf3228dacecb8685f80545ef13eea554))
- documentation for 3rd party import ([#367](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/367)) ([53ee469](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/53ee469b7cbba5042530d6436f1dbfaa447a1285))

## [2.9.10](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.9...netzgrafik-frontend-v2.9.10) (2024-11-22)

### Bug Fixes

- warn users when having unsymmetric times ([#359](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/359)) ([9923567](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/992356722772db594e48a1f7aa8511b904a62c79))

## [2.9.9](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.8...netzgrafik-frontend-v2.9.9) (2024-11-14)

### Bug Fixes

- performance opt / refactored ([#356](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/356)) ([f939df6](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f939df6640159e868802de80f12a40469bf8d943))

## [2.9.8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.7...netzgrafik-frontend-v2.9.8) (2024-11-14)

### Bug Fixes

- performance issue fixed (part 2) ([#354](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/354)) ([c8eb613](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/c8eb61364b7cf5ab8d41a2a04eba3e9d35c46562))

## [2.9.7](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.6...netzgrafik-frontend-v2.9.7) (2024-11-14)

### Bug Fixes

- 350 bug delete node or trainrunsections cause low performance ([#351](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/351)) ([72f8599](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/72f859920ac425668356fcb095f2ef49f019421f))

## [2.9.6](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.5...netzgrafik-frontend-v2.9.6) (2024-11-13)

### Bug Fixes

- 346 bug importing 3rd party json misses detecting non stop transitions ([#347](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/347)) ([9d71b4a](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9d71b4aa9608eaec4d50f7f13178693305ea4a3c))

## [2.9.5](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.4...netzgrafik-frontend-v2.9.5) (2024-11-11)

### Bug Fixes

- CSV base data export ([#343](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/343)) ([2d75f2d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/2d75f2da23d63a87638bac8ba3f1551f54054b9c))
- Simplified third-party JSON import (no port alignment/path precalculation required) ([#341](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/341)) ([d7d1776](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/d7d1776e7bb9fd4872821d315f9a81a8c2313c4d))

## [2.9.4](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.3...netzgrafik-frontend-v2.9.4) (2024-11-06)

### Bug Fixes

- 334 bug archived read mode allows to move nodes but not persisted ([#336](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/336)) ([6275ae1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/6275ae17929fbf564b7419896ad11946b90c20b1))

## [2.9.3](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.2...netzgrafik-frontend-v2.9.3) (2024-11-05)

### Bug Fixes

- fix O/D Matrix for trainrun 0 ([#337](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/337)) ([28a6d3a](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/28a6d3ae56c436a40e06eed54a3bbc117b97bdb7))

## [2.9.2](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.1...netzgrafik-frontend-v2.9.2) (2024-11-04)

### Bug Fixes

- While combining two trainruns the first trainrun will "survive" and the second one will be deleted. If the trainrun which will be deleted consists of more than one trainrun segment (connected paths) the reported issue will be generated. (Test added) ([c55388b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/c55388b2d58efd788d64f745560c4b37c5d227e9))

## [2.9.1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.9.0...netzgrafik-frontend-v2.9.1) (2024-10-28)

### Bug Fixes

- 320 bug graphical timetable streckengrafik renders only one trainrun segement ([#325](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/325)) ([790f53b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/790f53b7f7493cc7204719643dd368eccad89d16))

## [2.9.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.8.0...netzgrafik-frontend-v2.9.0) (2024-10-24)

### Features

- migrate originDestination connectionPenalty to netzgrafikDto ([#314](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/314)) ([ce3f90d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/ce3f90d73784fabb49f29ac3625b142ceaa4134f))
- optimize originDestination graph ([#316](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/316)) ([83895a1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/83895a153bcbc83cbbb692f48b8df196a56a9467))

### Bug Fixes

- fix O/D Matrix for unordered trainruns ([#321](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/321)) ([3d9644f](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/3d9644fbe94ea0a11a5403b798ea5634481166fa))

## [2.8.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.17...netzgrafik-frontend-v2.8.0) (2024-10-10)

### Features

- Implement Origin/Destination matrix ([#301](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/301)) ([383c99d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/383c99d9e2081c1587bf36aa71dcb7ee6e73c7d9))

## [2.7.17](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.16...netzgrafik-frontend-v2.7.17) (2024-10-03)

### Bug Fixes

- Documentation enhanced and standalone application deployed to github pages ([#304](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/304)) ([bee16d2](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/bee16d216a980bb32fdd0e6427d90c775bcd4292))

## [2.7.16](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.15...netzgrafik-frontend-v2.7.16) (2024-09-26)

### Bug Fixes

- some translations ([#299](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/299)) ([c29c93f](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/c29c93f2e48fb294484d31e7238da637620c6e43))

## [2.7.15](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.14...netzgrafik-frontend-v2.7.15) (2024-09-19)

### Bug Fixes

- doc: Split_Combine_Trainruns.md grammar ([#293](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/293)) ([ae64d44](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/ae64d446ca979db5b95601dbd414a3c9d6e6419f))
- doc: STANDALONE.md grammar ([#292](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/292)) ([22f4f87](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/22f4f87074faa9b9a06a7b482ffb9a0d7312303d))
- doc: USERMANUAL.md spelling grammar punctuation ([#294](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/294)) ([6a402c8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/6a402c87322bac3daedadf7bc359c2875f7b31c1))

## [2.7.14](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.13...netzgrafik-frontend-v2.7.14) (2024-09-16)

### Bug Fixes

- doc: DATA_MODEL_JSON.md, spelling ([#276](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/276)) ([f504f0d](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f504f0d40a4269fb4ab5a47ce6797e43c1564d32))
- doc: Graphic_Timetable.md, spelling, grammar ([#277](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/277)) ([853b80f](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/853b80fa30b4e2119a919787f2b22bd4f4ac2600))

## [2.7.13](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.12...netzgrafik-frontend-v2.7.13) (2024-08-29)

### Bug Fixes

- Bug archived read only mode variants are editable even tho not persisted ([#257](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/257)) ([9472a89](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9472a89c445e3473877e7fe80add5f5e3cc37863))

## [2.7.12](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.11...netzgrafik-frontend-v2.7.12) (2024-08-29)

### Bug Fixes

- Technical improvement: replace hard-coded styles with CSS class for sbb-icon-sidebar-container. This improves maintainability and reusability of styles. ([#273](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/273)) ([b505d03](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/b505d03f4296809fe5e53c7ad216ca006bb234cc))

## [2.7.11](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.10...netzgrafik-frontend-v2.7.11) (2024-08-28)

### Bug Fixes

- doc: CREATE_TRAINRUN.md, spelling, grammar ([#267](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/267)) ([a9e1747](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/a9e1747f7b9dcdb4c5cee2a3e52be7426b526ad4))

## [2.7.10](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.9...netzgrafik-frontend-v2.7.10) (2024-08-26)

### Bug Fixes

- Update de.json, en.jason, spelling ([#259](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/259)) ([a166d83](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/a166d83a4689864410715949da01df04524e3d26))

## [2.7.9](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.8...netzgrafik-frontend-v2.7.9) (2024-08-26)

### Bug Fixes

- doc: CREATE_NODES.md, spelling ([#264](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/264)) ([30cf1d7](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/30cf1d73dda29cb153fd04354c2ec1bb912b1758))

## [2.7.8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.7...netzgrafik-frontend-v2.7.8) (2024-08-24)

### Bug Fixes

- doc: Update CREATE_FILTERS.md, spelling ([#258](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/258)) ([e0eb559](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e0eb5592b3e0a9cd25f74ffacfe411b4f73d1369))

## [2.7.7](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.6...netzgrafik-frontend-v2.7.7) (2024-08-20)

### Bug Fixes

- Long email addresses cause incorrect formatting of the left sidebar change history ([#243](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/243)) ([dd0fda5](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/dd0fda51f8ada14e340ae6e821e153aeac42ad7a))
- Viewport Not Centering on Bounding Box When Reloading/Opening Netzgrafik ([#244](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/244)) ([9e5e2fd](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9e5e2fdf85ff2c8eec9a568c2af656744f0d69af))
- Translation is not working for variant when archived ([#249](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/249)) ([e313580](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e3135804cf93a47a35162ab82554507d9e8b3403))
- The menubar has a visual "thick" separator in between variant/project name and the filter symbol ([#252](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/252)) ([3496d0a](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/3496d0a2dcb7b960d14c49e15abcfd2034f65d99))

## [2.7.6](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.5...netzgrafik-frontend-v2.7.6) (2024-08-19)

### Bug Fixes

- use change event instead of keyup for node name change ([#248](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/248)) ([1e1177b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1e1177b3f382f10e36deb8f9080b6c58522a43bc))

## [2.7.5](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.4...netzgrafik-frontend-v2.7.5) (2024-08-08)

### Features

- add AppComponent inputs/outputs ([#166](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/166)) ([9d2c6ee](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9d2c6eee74f94912b68ec8b3375dc53e21a5ecdc))
- introduce standalone mode ([#162](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/162)) ([cc4c56b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/cc4c56b25aa2d978ebd70fbf34dc129f36b776b2))
- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))
- publish package on NPM ([#172](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/172)) ([1692d55](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1692d5561f8e1fd8b00a60b673b7567d81d83aef))

### Bug Fixes

- align theme color picker with buttons ([#198](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/198)) ([e3a8798](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e3a87989ea28a04a4a0bb9cee825825bb1b97d7b))
- disable environment header in standalone mode ([#230](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/230)) ([e25887e](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e25887eb11ab36ce84756e92344bc63cdeb9b1a4))
- disable links section in node sidebar ([2554094](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/255409410aa2552dfc1155bf89e7afce78dc17bc))
- disable notes in filter sidebar in standalone mode ([#211](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/211)) ([df335ef](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/df335ef9aede8c47064655f3dbcc5723c2a89f1a))
- enable output hashing by default ([#174](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/174)) ([8ac67b8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/8ac67b807db1e0fc418d4bacddabfabcb80620f4))
- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))
- use light theme for sbb-esta ([#176](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/176)) ([89aaae0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89aaae004170b59649b0856f14de1d31e86a6e18))

### Miscellaneous Chores

- release 2.5.0 ([00e6836](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/00e68365b1401d0af211cf6f9cd3184ed61fa102))
- release 2.7.3 ([f06b8ff](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f06b8ff117a30c4ed0a2084c6a75dfd4e72d254b))
- release 2.7.3 ([484e008](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/484e0081b69b59c0f41857bab66ac8b024d95e86))
- release 2.7.5 ([f69edec](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f69edecca48480cd1f4483cd8d9b655ef7cfd512))

## [2.7.4](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.7.3...v2.7.4) (2024-08-08)

### Bug Fixes

- disable environment header in standalone mode ([#230](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/230)) ([e25887e](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e25887eb11ab36ce84756e92344bc63cdeb9b1a4))

## [2.7.3](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.7.2...v2.7.3) (2024-08-06)

### Features

- add AppComponent inputs/outputs ([#166](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/166)) ([9d2c6ee](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9d2c6eee74f94912b68ec8b3375dc53e21a5ecdc))
- introduce standalone mode ([#162](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/162)) ([cc4c56b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/cc4c56b25aa2d978ebd70fbf34dc129f36b776b2))
- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))
- publish package on NPM ([#172](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/172)) ([1692d55](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1692d5561f8e1fd8b00a60b673b7567d81d83aef))

### Bug Fixes

- align theme color picker with buttons ([#198](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/198)) ([e3a8798](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e3a87989ea28a04a4a0bb9cee825825bb1b97d7b))
- disable links section in node sidebar ([2554094](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/255409410aa2552dfc1155bf89e7afce78dc17bc))
- disable notes in filter sidebar in standalone mode ([#211](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/211)) ([df335ef](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/df335ef9aede8c47064655f3dbcc5723c2a89f1a))
- enable output hashing by default ([#174](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/174)) ([8ac67b8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/8ac67b807db1e0fc418d4bacddabfabcb80620f4))
- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))
- use light theme for sbb-esta ([#176](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/176)) ([89aaae0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89aaae004170b59649b0856f14de1d31e86a6e18))

### Miscellaneous Chores

- release 2.5.0 ([00e6836](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/00e68365b1401d0af211cf6f9cd3184ed61fa102))
- release 2.7.3 ([f06b8ff](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/f06b8ff117a30c4ed0a2084c6a75dfd4e72d254b))
- release 2.7.3 ([484e008](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/484e0081b69b59c0f41857bab66ac8b024d95e86))

## [2.7.2](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.2...netzgrafik-frontend-v2.7.2) (2024-08-06)

### Bug Fixes

- disable notes in filter sidebar in standalone mode ([#211](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/211)) ([df335ef](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/df335ef9aede8c47064655f3dbcc5723c2a89f1a))

## [2.7.2](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/netzgrafik-frontend-v2.7.2...netzgrafik-frontend-v2.7.2) (2024-08-06)

### Bug Fixes

- disable notes in filter sidebar in standalone mode ([#211](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/211)) ([df335ef](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/df335ef9aede8c47064655f3dbcc5723c2a89f1a))

## 2.7.2 (2024-08-06)

### Features

- add AppComponent inputs/outputs ([#166](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/166)) ([9d2c6ee](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9d2c6eee74f94912b68ec8b3375dc53e21a5ecdc))
- introduce standalone mode ([#162](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/162)) ([cc4c56b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/cc4c56b25aa2d978ebd70fbf34dc129f36b776b2))
- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))
- publish package on NPM ([#172](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/172)) ([1692d55](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1692d5561f8e1fd8b00a60b673b7567d81d83aef))

### Bug Fixes

- align theme color picker with buttons ([#198](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/198)) ([e3a8798](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e3a87989ea28a04a4a0bb9cee825825bb1b97d7b))
- enable output hashing by default ([#174](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/174)) ([8ac67b8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/8ac67b807db1e0fc418d4bacddabfabcb80620f4))
- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))
- use light theme for sbb-esta ([#176](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/176)) ([89aaae0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89aaae004170b59649b0856f14de1d31e86a6e18))

### Miscellaneous Chores

- release 2.5.0 ([00e6836](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/00e68365b1401d0af211cf6f9cd3184ed61fa102))

## 2.7.1 Manually edited version number (preparation automatic release building)

### Bug Fixes

- align theme color picker with buttons ([#198](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/198)) ([e3a8798](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/e3a87989ea28a04a4a0bb9cee825825bb1b97d7b))

## [2.6.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.5.0...v2.6.0) (2024-07-22)

### Features

- add AppComponent inputs/outputs ([#166](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/166)) ([9d2c6ee](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/9d2c6eee74f94912b68ec8b3375dc53e21a5ecdc))
- introduce standalone mode ([#162](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/162)) ([cc4c56b](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/cc4c56b25aa2d978ebd70fbf34dc129f36b776b2))
- publish package on NPM ([#172](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/172)) ([1692d55](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/1692d5561f8e1fd8b00a60b673b7567d81d83aef))

### Bug Fixes

- enable output hashing by default ([#174](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/174)) ([8ac67b8](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/8ac67b807db1e0fc418d4bacddabfabcb80620f4))
- use light theme for sbb-esta ([#176](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/176)) ([89aaae0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89aaae004170b59649b0856f14de1d31e86a6e18))

## [2.5.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.5.0...v2.5.0) (2024-04-22)

### Features

- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))

### Bug Fixes

- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))

### Miscellaneous Chores

- release 2.5.0 ([00e6836](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/00e68365b1401d0af211cf6f9cd3184ed61fa102))

## [2.5.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.5.0...v2.5.0) (2024-04-22)

### Features

- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))

### Bug Fixes

- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))

### Miscellaneous Chores

- release 2.5.0 ([00e6836](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/00e68365b1401d0af211cf6f9cd3184ed61fa102))

## [2.5.0](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/compare/v2.4.0...v2.5.0) (2024-04-15)

### Features

- **pr-template:** add pull request template ([89b4d61](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/89b4d61954382c45ffd20ac54137d1faf2f0c5f9))

### Bug Fixes

- issue I. + typo ([#72](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/issues/72)) ([deb7cd1](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/commit/deb7cd1514a320ca14d53bdd26cdbdeff6005c79))
