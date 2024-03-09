/// <reference path="bbCodeParser.ts" />

//The type of token
enum TokenType { Text, StartTag, EndTag }

//Represents a token
class Token {
    constructor(public tokenType: TokenType, public content: string, public tagAttributes?: Array<string>, public tagStr?: string) {

    }

    //String representation of the token
    toString() {
        return this.content + " (" + TokenType[this.tokenType] + ")";
    }

    //Check for equality
    equals(token: Token) {
        return this.tokenType == token.tokenType && this.content == token.content;
    }
}

//Creates a new text token
function textToken(content: string) {
    return new Token(TokenType.Text, content);
}

const attrNameChars = "[a-zA-Z0-9\\.\\-_:;/]";
//var attrNameChars = "\\w";
const attrValueChars = "[a-zA-Z0-9\\.\\-_:;#/\\s]";

//Creates a new tag token
function tagToken(match) {
    if (match[1] == undefined) { //Start tag
        let tagName = match[2];
        const attributes = new Array<string>();
        const attrPattern = new RegExp("(" + attrNameChars + "+)?=([\"])(" + attrValueChars + "+)\\2", "g");

        const attrStr = match[0].substring(1 + tagName.length, match[0].length - 2 - tagName.length);

        let attrMatch;
        while (attrMatch = attrPattern.exec(attrStr)) {
            if (attrMatch[1] == undefined) { //The tag attribute
                attributes[tagName] = attrMatch[3];
            } else { //Normal attribute
                attributes[attrMatch[1]] = attrMatch[3];
            }
        }

        return new Token(TokenType.StartTag, tagName, attributes, match[0]);
    } else { //End tag
        return new Token(TokenType.EndTag, match[1].substring(1, match[1].length - 1));
    }
}

//Converts the given token to a text token
function asTextToken(token: Token) {
    if (token.tokenType == TokenType.StartTag) {
        token.content = token.tagStr;
        token.tokenType = TokenType.Text;
        //delete token.attributes;
        //delete token.tagStr;
    }

    if (token.tokenType == TokenType.EndTag) {
        token.content = "[/" + token.content + "]";
        token.tokenType = TokenType.Text;
    }
}

//Represents a tokenizer
class Tokenizer {
    //Creates a new tokenizer with the given tags
    constructor(private bbTags: Array<BBTag>) {

    }

    //Tokenizes the given string
    tokenizeString(str: string) {
        let tokens = this.getTokens(str);
        let newTokens = new Array<Token>();

        let noNesting = false;
        let noNestingTag = "";
        let noNestedTagContent = "";

        for (let i in tokens) {
            let currentToken = tokens[i];
            let bbTag: BBTag = this.bbTags[currentToken.content];
            let addTag = true;

            //Replace invalid tags with text
            if (bbTag === undefined && !noNesting) {
                asTextToken(currentToken);
            } else {
                //Check if current tag doesn't support nesting
                if (noNesting) {
                    if (currentToken.tokenType == TokenType.EndTag && currentToken.content == noNestingTag) {
                        noNesting = false;
                        newTokens.push(textToken(noNestedTagContent));
                    } else {
                        asTextToken(currentToken);
                        noNestedTagContent += currentToken.content;
                        addTag = false;
                    }
                } else {
                    if (bbTag.noNesting && currentToken.tokenType == TokenType.StartTag) {
                        noNesting = true;
                        noNestingTag = currentToken.content;
                        noNestedTagContent = "";
                    }
                }
            }

            if (addTag) {
                newTokens.push(currentToken);
            }
        }

        return newTokens;
    }

    //Gets the tokens from the given string
    getTokens(str: string) {
        const pattern = "\\[(\/\\w*)\\]|\\[(\\w*)+(=([\"])" + attrValueChars + "*\\4)?( (" + attrNameChars + "+)?=([\"])(" + attrValueChars + "+)\\7)*\\]";
        const tagPattern = new RegExp(pattern, "g");
        const tokens = new Array<Token>();

        let match;
        let lastIndex = 0;

        while (match = tagPattern.exec(str)) {
            let delta = match.index - lastIndex;

            if (delta > 0) {
                tokens.push(textToken(str.substring(lastIndex, delta)));
            }

            tokens.push(tagToken(match));
            lastIndex = tagPattern.lastIndex;
        }

        let delta = str.length - lastIndex;

        if (delta > 0) {
            tokens.push(textToken(str.substring(lastIndex, delta)));
        }

        return tokens;
    }
}