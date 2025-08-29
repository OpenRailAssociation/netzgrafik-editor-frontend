### Merge two independent Netzgrafik

To merge two Netzgrafik, you can use the split/combine technique. For example, if you have a Netzgrafik for the eastern part of Switzerland and one for the western part, you can merge the western into the eastern part by using copy-paste and trainrun combine techniques. First, copy the western part (all trains that need to be integrated into the eastern part). Then, insert the copied trainruns and nodes into the eastern part. After inserting, the resulting Netzgrafik will have all trainruns included, but the eastern and western parts of the trainruns are not yet combined. The eastern and western trainrun parts are still independent trainruns. Now, use the combine method to connect the trainruns. Once all trainruns are combined, the resulting Netzgrafik will be the merged one.

To merge two independent Netzgrafik, you can follow these steps:

- Identify the two Netzgrafik that you want to merge.
- Determine the trains and nodes that you want to combine.
- (Optional) Create a new variant.
- Copy the necessary elements from one Netzgrafik and paste them into the other Netzgrafik.
- As long as complete trainruns are copied, i.e. including all trainrun sections from start to destination, there is no need to merge trainruns. If the Netzgrafiks to be merged consists of regions (or partial corridors)
  or just trainrun sections that actually represent partial trainrun, these must be merged manually using the [combine function](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/blob/main/documentation/Split_Combine_Trainruns.md#combine-two-trainruns) at the nodes where the parts of the trainrun meet.

By following these steps, you can successfully merge two independent Netzgrafik.

[Merge_East_West_Trainruns.webm](https://github.com/SchweizerischeBundesbahnen/netzgrafik-editor-frontend/assets/10423646/74277415-b522-4dc3-b2da-2f93e7fb5411)
