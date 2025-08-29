# Trainrun iterator

## Sample code

https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/pull/325

### Simple trainrun iterator - just one trainrun part

To iterate starting from a node of interest with the orientation passed through the trainrun section, you can use the sample code (pattern) below.
The iteration will proceed along the trainrun. Be aware that this does not ensure traveling through the full train run.

```typescript

  // create forward iterator
  const iterator: TrainrunIterator = this.trainrunService.getIterator(
    startForwardNode,
    startTrainrunSection,
  );
  while (iterator.hasNext()) {
    // move iterator forward
    const currentTrainrunSectionNodePair = iterator.next();

    // get data
    const trainrunSection = currentTrainrunSectionNodePair.trainrunSection;
    const node = currentTrainrunSectionNodePair.node;

  ...
    user
    defined
    data
    processing
  ...

  }
}
```

### Complete Train Run Iterator - Over All Train Run Parts

Iterator pattern for iterating through all train run parts separately.

![image](https://github.com/user-attachments/assets/d87b842c-7696-4e81-aa78-75cc966b5306)
_Example Netzgrafik with missing sections (See the cargo trainrun GTwo_Part_trainrun)_

[See also](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/CREATE_TRAINRUN.md#special-cases)

```typescript
getForwardTrainrunPartIterator(trainrunSection : TrainrunSection) {
      // find both start nodes ( N1 - N2 - N3 - N4 ) => N1 , N2
      const bothEndNodes =
        this.trainrunService.getBothEndNodesFromTrainrunPart(trainrunSection);

      // get start / end node from Top/Left -> Botton / Right
      const startForwardNode = GeneralViewFunctions.getLeftOrTopNode(
        bothEndNodes.endNode1,
        bothEndNodes.endNode2,
      );

      // get start trainrun section -> forward direction/orientation
      const startTrainrunSection = startForwardNode.getStartTrainrunSection(
        trainrun.getId(),
      );

      // create forward iterator
      const iterator: TrainrunIterator = this.trainrunService.getIterator(
        startForwardNode,
        startTrainrunSection,
      );
  return iterator;
}

simpleTrainrunAllPartsIterator(trainrun: Trainrun) {
    let alltrainrunsections =
      this.trainrunSectionService
        .getAllTrainrunSectionsForTrainrun(trainrun.getId());

    while (alltrainrunsections.length > 0) {
      // traverse over all trainrun parts
       const iterator= getForwardTrainrunPartIterator(alltrainrunsections[0]);

      while (iterator.hasNext()) {
        // move iterator forward
        const currentTrainrunSectionNodePair = iterator.next();

        // get data
        const trainrunSection = currentTrainrunSectionNodePair.trainrunSection;
        const node = currentTrainrunSectionNodePair.node;

      ...
        user
        defined
        data
        processing
      ...

        // filter all still visited trainrun sections
        alltrainrunsections = alltrainrunsections.filter(ts =>
          ts.getId() !== trainrunSection.getId()
        );
      }


    }
  }
```
