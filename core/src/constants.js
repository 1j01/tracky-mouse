
/** Named lists of facemesh landmark indices */
export const MESH_ANNOTATIONS = {
	silhouette: [
		10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
		397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
		172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
	],

	lipsUpperOuter: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291],
	lipsLowerOuter: [146, 91, 181, 84, 17, 314, 405, 321, 375, 291],
	lipsUpperInner: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308],
	lipsLowerInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],

	rightEyeUpper0: [246, 161, 160, 159, 158, 157, 173],
	rightEyeLower0: [33, 7, 163, 144, 145, 153, 154, 155, 133],
	rightEyeUpper1: [247, 30, 29, 27, 28, 56, 190],
	rightEyeLower1: [130, 25, 110, 24, 23, 22, 26, 112, 243],
	rightEyeUpper2: [113, 225, 224, 223, 222, 221, 189],
	rightEyeLower2: [226, 31, 228, 229, 230, 231, 232, 233, 244],
	rightEyeLower3: [143, 111, 117, 118, 119, 120, 121, 128, 245],

	rightEyebrowUpper: [156, 70, 63, 105, 66, 107, 55, 193],
	rightEyebrowLower: [35, 124, 46, 53, 52, 65],

	rightEyeIris: [473, 474, 475, 476, 477],

	leftEyeUpper0: [466, 388, 387, 386, 385, 384, 398],
	leftEyeLower0: [263, 249, 390, 373, 374, 380, 381, 382, 362],
	leftEyeUpper1: [467, 260, 259, 257, 258, 286, 414],
	leftEyeLower1: [359, 255, 339, 254, 253, 252, 256, 341, 463],
	leftEyeUpper2: [342, 445, 444, 443, 442, 441, 413],
	leftEyeLower2: [446, 261, 448, 449, 450, 451, 452, 453, 464],
	leftEyeLower3: [372, 340, 346, 347, 348, 349, 350, 357, 465],

	leftEyebrowUpper: [383, 300, 293, 334, 296, 336, 285, 417],
	leftEyebrowLower: [265, 353, 276, 283, 282, 295],

	leftEyeIris: [468, 469, 470, 471, 472],

	midwayBetweenEyes: [168],

	noseTip: [1],
	noseBottom: [2],
	noseRightCorner: [98],
	noseLeftCorner: [327],

	rightCheek: [205],
	leftCheek: [425]
};

export const infoIconSVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>`;
// export const infoIconSVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" fill="none">
// 	<path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" stroke-width="3"/>
// 	<path d="M24 20.5V34.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
// 	<path d="M24 15C24.8284 15 25.5 14.3284 25.5 13.5C25.5 12.6716 24.8284 12 24 12C23.1716 12 22.5 12.6716 22.5 13.5C22.5 14.3284 23.1716 15 24 15Z" fill="currentColor"/>
// </svg>`;
// export const infoIconSVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M46 24C46 36.1503 36.1503 46 24 46C11.8497 46 2 36.1503 2 24C2 11.8497 11.8497 2 24 2C36.1503 2 46 11.8497 46 24ZM26.75 13C26.75 14.5188 25.5188 15.75 24 15.75C22.4812 15.75 21.25 14.5188 21.25 13C21.25 11.4812 22.4812 10.25 24 10.25C25.5188 10.25 26.75 11.4812 26.75 13ZM21.25 21.25C19.7312 21.25 18.5 22.4812 18.5 24C18.5 25.5188 19.7312 26.75 21.25 26.75V35C21.25 36.5188 22.4812 37.75 24 37.75H26.75C28.2688 37.75 29.5 36.5188 29.5 35C29.5 33.4812 28.2688 32.25 26.75 32.25V24C26.75 22.4812 25.5188 21.25 24 21.25H21.25Z" fill="currentColor"/></svg>`;

export const resetIconSVG = `<svg aria-hidden="true" focusable="false" viewBox="0 0 48 48" fill="none"><path d="M2.16645 21.8503C1.94452 21.6506 1.94452 21.3026 2.16645 21.1028L21.0251 4.13007C21.3487 3.83884 21.8643 4.06848 21.8643 4.50381V16.4483C35.1941 16.4483 46 27.2542 46 40.584C46 41.4921 45.9498 42.3885 45.8522 43.2706C45.7924 43.8106 45.034 43.8362 44.8694 43.3185C41.7688 33.5684 32.6415 26.5049 21.8643 26.5049V38.4493C21.8643 38.8847 21.3487 39.1143 21.0251 38.8231L2.16645 21.8503Z" fill="currentColor"/></svg>`;
