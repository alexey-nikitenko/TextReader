let xmlDoc;
let lastBookmarkId = null;

// File input handler
document.getElementById('fileInput').addEventListener('change', function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
            const fb2Text = event.target.result;
            const parser = new DOMParser();
            xmlDoc = parser.parseFromString(fb2Text, "application/xml");

            const body = xmlDoc.getElementsByTagName("body")[0];
            if (body) {
                console.log("FB2 content loaded successfully.");
                document.getElementById('saveButton').style.display = 'inline';
                document.getElementById('bookmarkButton').style.display = 'inline';
                document.getElementById('loadAllButton').style.display = 'inline';
                document.getElementById('loadBookmarkButton').style.display = 'inline';

                const bookmarks = body.querySelectorAll('[data-bookmark-id]');
                if (bookmarks.length > 0) {
                    lastBookmarkId = bookmarks[0].getAttribute('data-bookmark-id');
                    console.log("Bookmark found with ID:", lastBookmarkId);
                }

                loadContent(body, "all");
            } else {
                console.error("Could not parse FB2 content.");
                document.getElementById('content').innerHTML = "Could not parse FB2 content.";
            }
        };
        reader.readAsText(file);
    }
});

// Load all content
document.getElementById('loadAllButton').addEventListener('click', function () {
    if (xmlDoc) {
        const body = xmlDoc.getElementsByTagName("body")[0];
        loadContent(body, "all");
    } else {
        console.error("No XML document loaded.");
    }
});

// Load from bookmark
document.getElementById('loadBookmarkButton').addEventListener('click', function () {
    const contentDiv = document.getElementById('content');
    if (contentDiv && lastBookmarkId) {
        let foundBookmark = false;

        // Traverse <p> tags and selectively clear content only for <p> above the bookmark
        Array.from(contentDiv.querySelectorAll('p')).forEach((node) => {
            const bookmarkId = node.getAttribute('data-bookmark-id');

            if (bookmarkId === lastBookmarkId) {
                foundBookmark = true; // Bookmark is found, stop clearing subsequent paragraphs
                console.log(`Found bookmark with ID: ${bookmarkId}`);
            }

            if (!foundBookmark) {
                // Clear the content of <p> tags above the bookmark
                console.log(`Clearing content of <p>: ${node.textContent}`);
                node.textContent = ""; // Clear only the text content
            } else {
                console.log(`Keeping content of <p>: ${node.textContent}`);
            }
        });

        // Scroll to the bookmarked paragraph after processing
        scrollToBookmark(lastBookmarkId);
    } else {
        console.error("No bookmark found or no content loaded.");
    }
});



// Save changes
document.getElementById('saveButton').addEventListener('click', function () {
    if (xmlDoc) {
        const body = xmlDoc.getElementsByTagName("body")[0];
        const contentDiv = document.getElementById('content');
        updateXmlBody(body, contentDiv);

        const serializer = new XMLSerializer();
        const updatedFb2Text = serializer.serializeToString(xmlDoc);

        const blob = new Blob([updatedFb2Text], { type: "application/xml" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'modified.fb2';
        a.click();

        console.log("File saved with updated bookmark.");
    } else {
        console.error("No XML document loaded to save.");
    }
});

// Add bookmark
document.getElementById('bookmarkButton').addEventListener('click', function () {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let parentParagraph = range.startContainer;
        while (parentParagraph && parentParagraph.nodeName !== 'P') {
            parentParagraph = parentParagraph.parentElement;
        }
        if (parentParagraph) {
            document.querySelectorAll('[data-bookmark-id]').forEach(node => {
                node.removeAttribute('data-bookmark-id');
                node.classList.remove('bookmark');
            });

            const bookmarkId = 'bookmark-' + new Date().getTime();
            parentParagraph.setAttribute('data-bookmark-id', bookmarkId);
            parentParagraph.classList.add('bookmark');

            saveBookmark(bookmarkId);
            console.log("Bookmark added with ID:", bookmarkId);
        } else {
            console.error("Selection is not within a paragraph.");
        }
    } else {
        console.error("No selection found for adding a bookmark.");
    }
});

// Parse FB2 body
function parseFb2Body(body) {
    let html = "";
    body.childNodes.forEach(node => {
        if (node.nodeName === "section") {
            html += parseSection(node);
        } else if (node.nodeName === "p") {
            const bookmarkId = node.getAttribute('data-bookmark-id');
            let paragraphHtml = "<p";
            if (bookmarkId) {
                paragraphHtml += ` data-bookmark-id="${bookmarkId}" class="bookmark"`;
            }
            paragraphHtml += ">" + node.textContent + "</p>";
            html += paragraphHtml;
        } else if (node.nodeName === "title") {
            html += "<h2>" + node.textContent + "</h2>";
        }
    });
    return html;
}

// Parse sections recursively
function parseSection(section) {
    let sectionHtml = "<div class='section'>";
    section.childNodes.forEach(node => {
        if (node.nodeName === "title") {
            sectionHtml += "<h2>" + node.textContent + "</h2>";
        } else if (node.nodeName === "p") {
            const bookmarkId = node.getAttribute('data-bookmark-id');
            let paragraphHtml = "<p";
            if (bookmarkId) {
                paragraphHtml += ` data-bookmark-id="${bookmarkId}" class="bookmark"`;
            }
            paragraphHtml += ">" + node.textContent + "</p>";
            sectionHtml += paragraphHtml;
        } else if (node.nodeName === "section") {
            sectionHtml += parseSection(node);
        }
    });
    sectionHtml += "</div>";
    return sectionHtml;
}

// Update XML body with changes
function updateXmlBody(body, contentDiv) {
    const updatedParagraphs = contentDiv.querySelectorAll('p[data-bookmark-id]');

    if (updatedParagraphs.length > 0) {
        const bookmarkId = updatedParagraphs[0].getAttribute('data-bookmark-id');
        const bookmarkText = updatedParagraphs[0].textContent;

        // Iterate through all <p> nodes in the XML body
        let found = false;
        Array.from(body.getElementsByTagName('p')).forEach((p) => {
            if (p.textContent === bookmarkText) {
                // Update the existing <p> with the new bookmark
                p.setAttribute('data-bookmark-id', bookmarkId);
                found = true;
            } else {
                // Remove old bookmarks
                p.removeAttribute('data-bookmark-id');
            }
        });

        // If no matching <p> exists, throw an error (shouldn't happen)
        if (!found) {
            console.error("Matching <p> element not found for the bookmark.");
        }
    }
}


// Load content
function loadContent(body, type) {
    const contentDiv = document.getElementById('content');
    if (type === "all") {
        contentDiv.innerHTML = parseFb2Body(body);
    }
}

// Scroll to bookmark
function scrollToBookmark(bookmarkId) {
    const bookmarkElement = document.querySelector(`[data-bookmark-id='${bookmarkId}']`);
    if (bookmarkElement) {
        bookmarkElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Save bookmark in XML
function saveBookmark(bookmarkId) {
    let bookmarks = xmlDoc.getElementsByTagName('bookmarks')[0];
    if (!bookmarks) {
        bookmarks = xmlDoc.createElement('bookmarks');
        xmlDoc.documentElement.appendChild(bookmarks);
    }

    while (bookmarks.firstChild) {
        bookmarks.removeChild(bookmarks.firstChild);
    }

    const bookmark = xmlDoc.createElement('bookmark');
    bookmark.setAttribute('id', bookmarkId);
    bookmarks.appendChild(bookmark);
}
