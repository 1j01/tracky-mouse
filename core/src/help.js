export const helpContentHTML = `
<h2>Camera Placement</h2>
<p>
	Position your camera at eye level and ensure your face is fully visible.
	<!--
Placing the camera above the screen is recommended.


 Above or below the screen is fine but you should be centered so the pointer doesn't move left/right too much when you want it to go up or down

    In particular, you should be in line with the camera, such that your face appears head-on when looking comfortably at the center of the screen
        A guide could show your head rotation
        Calibration for an off-center camera should be possible (or explicitly using your head rotation instead of a projected position)

If the camera is above, leaning forward generally moves the pointer down
If the camera is below, leaning forward generally moves the pointer up


	-->
</p>
<h2>Lighting</h2>
<p>
	Good lighting is important for accurate head tracking.
</p>
<p>
	Make sure your face is well-lit and avoid strong backlighting.
</p>
<h2>Calibration</h2>
<p>
	Tracky Mouse uses a combination of Point Tracking (2D) and Head Tilt (3D).
	The Point Tracking is good for detecting small movements,
	while Head Tilt <!--provides an absolute mapping of head position to screen position. -->
	avoids drift over time.
</p>
<p>
	The following steps assume <b>Movement mode</b> is set to <b>Direct</b>.
</p>
<ol>
<li>Set "Tilt influence" to the minimum, so it uses only Point Tracking (2D).</li>
<li>Adjust the sensitivity and acceleration under "Point tracking" until it feels comfortable to point at any location on the screen.</li>
<li>Set "Tilt influence" to the maximum, so it uses only Head Tilt (3D).</li>
<li>Adjust the settings under "Head tilt calibration" until it feels comfortable to point at any location on the screen.</li>
<li>Adjust "Tilt influence" to find a balance between Point Tracking and Head Tilt.</li>
</ol>
<h3>A few more tips:</h3>
<p>
	For point tracking, higher acceleration makes it smoother and more stable.
	It helps to keep the mouse in one spot.
</p>
<p>
	However, with the joystick and D-pad style movement modes, you may want less acceleration, since it doesn't help keep the mouse in one spot, only the virtual joystick position.
</p>
<p>
	Don't bother with the "Motion threshold" setting.
</p>
<h2>Troubleshooting camera access</h2>
<p>
	If there's a problem accessing the camera, try the following:
</p>
<ul>
<li>Make sure the correct camera is selected in <b>Video > Camera source</b>.</li>
<li>
	Check if another application is using it.
	If there's an activity light on the camera, this is a strong clue that it is currently in use.
</li>
<li>Try unplugging and plugging it back in (if it's an external camera).</li>
<li>Check if you can use your camera with another application.</li>
<li>On Linux, installing <code>guvcview</code> can magically fix a webcam not showing up. (<a target="_blank" href="https://forums.linuxmint.com/viewtopic.php?t=131011">source</a>)</li>
<li>Restart the computer if needed.</li>
</ul>
`;