# Mouth Pose Dataset Collector

This is an applet for collecting mouth images associated with different mouth poses, across a range of angles, for use in training a machine learning model to predict tongue position from video. 

Hopefully this will power a ["tongue as joystick"](https://github.com/1j01/tracky-mouse/issues/116) feature in TrackyMouse, opening up the possibility of playing many more types of games, scrolling webpages more easily, and more.

## TODO

Important before serious usage:
- Crop is zooming differently based on mouth pose; should normalize using head size

High impact:
- Keyboard shortcut for starting/stopping recording (spacebar or R)
- A way to invalidate recent samples, such as an "Undo Last 5 Seconds" button, or a more dynamic rewind/erase feature, where you can preview the mouth as it rewinds so you can know when you can stop erasing. (shortcut could be backspace or Ctrl+Z or Z)
- Most mistakes will probably be made while starting/stopping recording, so storing this timing information could be useful for dataset cleanup.
- Instructions for usage, plus context about what the data is for.
  - When using a mobile device, you may want to rotate it around your head rather than rotating your head.
- Instructions to submit samples to the public dataset, with consent and optional consent to usage outside of the project
- Training data augmentation (lightness and color balance randomization, zoom/crop randomization, horizontal flips (with left/right labels reversed), adding speckles/distractors, maybe simulating images clipped at the edge of the video frame)

Medium impact:
- Currently samples are tracked and displayed before save success is confirmed.
Currently bucket gets filled even with failed snapshots, blocking further captures.
What should happen if a save fails?
What if a later save succeeds after a failure, creating a gap in the sample numbering?
- Redesign the layout of the training page to emphasize the hierarchy of: Dataset Folder > Poses > Samples, and Video Input > Mouth Preview. The recording button should be accessible from any scroll position and should change color to indicate recording status.
- Show progress for each pose. Guide the user through recording samples for each pose.
- A cursor within the photo sphere (other than highlighting the current bucket, which only applies once there are samples, and doesn't show you precisely when it will move to a different bucket)
- A timeline view, for dataset cleanup; some ideas (not necessarily mutually achievable or harmonious):
  - Showing frames from all poses, with labels; allowing re-labeling of frames
  - Leaving gaps in the timeline can help to see when a recording started or stopped (likely correlated with mislabeling)
  - Closing gaps in the timeline can make it easier to click to delete samples, if it makes the next delete button line up under the mouse
  - Keeping one frame in center view, like navigating a video, can help with temporal understanding of the samples, and a bigger view can make it easier to judge a sample quickly
  - Animating the photo sphere into the timeline view would be fun

Low impact:
- Coupling to private TrackyMouse internals: could extend the public API
  - maybe implement a "passive" mode to properly disable clicking/mouse movement and related settings
- Clickable li elements = not accessible
- Avoid wasting people's time in case I'm unable to receive submissions in the future, by creating a deadline that can be extended from time to time, showing a message when the deadline is reached
- store db handle for sample to avoid write after switching folders (unlikely race condition)
- drag between poses in selector for quicker switching (it's easier to compare the sets of samples if you don't have to click where you're not wanting to be looking)
- sound effects to make recording more satisfying (something clacky or like cards shuffling, or maybe a camera shutter although I feel keeping it "abstract" might be better; in other words, emphasizing the physicality of the thumbnails rather than the act of taking photos)

Style:
- page background doesn't extend to the edges of the page
- TM embed is too bright in dark mode
- "Samples Cloud" is too dark in light mode
- "Samples Cloud" wording?
- poses selector text alignment: left might look better
- could try a more descriptive "1x"-"5x" to indicate sample counts, and maybe make it less prominent; not sure how much I want to highlight less-than-max stacks; I don't want people to strain their neck trying to fill all the buckets, but in as much as they're *not* going to strain their neck, I *do* want to encourage filling more buckets... maybe a separate style for near-center buckets, treating the outer buckets as "bonus" samples that are nice to have but not expected to be filled
